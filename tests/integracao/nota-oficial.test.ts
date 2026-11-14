// Integração: o total da nota como oficial (#48) e várias linhas da nota no mesmo item (#49).
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import * as contrato from '../../shared/contratos/api.ts'
import { iniciarAmbiente, type Ambiente } from '../apoio/ambiente.ts'
import { clienteApi, conforme } from '../apoio/api.ts'
import { LINKS } from '../apoio/sefaz-falsa.ts'

let amb: Ambiente
let api: ReturnType<typeof clienteApi>

before(async () => {
  amb = await iniciarAmbiente()
  api = clienteApi(amb.url)
})
after(() => amb.encerrar())
beforeEach(() => amb.limpar())

async function compra(itens: { nome: string; preco: number; categoriaId: number }[], totalNota?: number) {
  const m = await api.post<{ id: number }>('/api/mercados', { nome: 'Mercado A' })
  const c = await api.post<{ id: number }>('/api/compras', { mercadoId: m.corpo.id })
  for (const i of itens) {
    await api.post(`/api/compras/${c.corpo.id}/itens`, {
      nome: i.nome,
      categoriaId: i.categoriaId,
      precoUnitario: i.preco,
      quantidade: 1,
      unidade: 'un',
    })
  }
  await api.post(`/api/compras/${c.corpo.id}/finalizar`, totalNota === undefined ? {} : { totalNota })
  return c.corpo.id
}

describe('total da nota como oficial', () => {
  it('compra, saldo e gastos usam a nota; a diferença vira uma linha das categorias', async () => {
    await api.post('/api/saldo', { saldo: 100_000 })
    const id = await compra(
      [
        { nome: 'Arroz', preco: 2_000, categoriaId: 6 },
        { nome: 'Detergente', preco: 1_000, categoriaId: 7 },
      ],
      2_800,
    )
    const resumo = conforme(contrato.resumoCompra, await api.get(`/api/compras/${id}`))
    assert.deepEqual([resumo.compra.total, resumo.compra.totalItens], [2_800, 3_000])

    const saldo = conforme(contrato.saldo, await api.get('/api/saldo'))
    assert.equal(saldo.budget.saldo, 100_000 - 2_800)

    const g = conforme(contrato.gastos, await api.get('/api/gastos'))
    assert.equal(g.total, 2_800)
    assert.deepEqual(
      g.porCategoria.map((c) => [c.categoria, c.total]),
      [
        ['Mercearia', 2_000],
        ['Limpeza', 1_000],
        ['Diferença da nota', -200],
      ],
    )
    assert.deepEqual(g.porMercado, [{ mercado: 'Mercado A', total: 2_800 }])
    const semana = g.semanas!.find((s) => s.gasto > 0)!
    assert.equal(semana.gasto, 2_800)
  })

  it('sem nota, vale a soma dos itens e não há linha de diferença', async () => {
    await compra([{ nome: 'Arroz', preco: 2_000, categoriaId: 6 }])
    const g = conforme(contrato.gastos, await api.get('/api/gastos'))
    assert.equal(g.total, 2_000)
    assert.ok(!g.porCategoria.some((c) => c.categoriaId === 0))
  })
})

describe('várias linhas da nota no mesmo item', () => {
  it('a mesma água em duas linhas: casa as duas com o item anotado e soma quantidade e pago', async () => {
    const id = await compra([{ nome: 'Água sem gás', preco: 149, categoriaId: 11 }])
    // Nota com a água passada duas vezes (1 + 2 un, a 1,69), desconto total de 0,60.
    await amb.sql`
      update compra set chave_nfce = '42261111222333000181650010000012341123456788', nfce_emitente = 'MERCADO EXEMPLO',
        desconto_nota_centavos = 60, total_nota_centavos = 447
      where id = ${id}
    `
    await amb.sql`
      insert into nfce_item (compra_id, ordem, codigo, descricao, quantidade, unidade, unitario_centavos, total_centavos)
      values (${id}, 1, '620', 'AGUA MINERAL 500ML S GAS', 1, 'UN', 169, 169),
             (${id}, 2, '620', 'AGUA MINERAL 500ML S GAS', 2, 'UN', 169, 338)
    `
    const conf = conforme(contrato.conferenciaNota, await api.get(`/api/compras/${id}/nfce`))
    const agua = (await api.get<{ itens: { id: number }[] }>(`/api/compras/${id}`)).corpo.itens[0]!
    assert.deepEqual(
      conf.linhas.map((l) => [l.ordem, l.compraItemId]),
      [
        [1, agua.id],
        [2, agua.id],
      ],
    )
    // Pago pelo anotado (1,49): 1,49 + 2,98; o desconto da nota fica todo explicado.
    assert.equal(conf.descontoSemItem, 0)

    const decisoes = conf.linhas.map((l) => ({ ordem: l.ordem, compraItemId: l.compraItemId! }))
    conforme(contrato.conferenciaNota, await api.post(`/api/compras/${id}/nfce/confirmar`, { decisoes }))
    const resumo = conforme(contrato.resumoCompra, await api.get(`/api/compras/${id}`))
    const linha = resumo.itens[0]!
    assert.deepEqual([linha.quantidade, linha.precoUnitario, linha.precoCheio, linha.total], [3, 149, 169, 447])
    assert.deepEqual([resumo.compra.total, resumo.compra.totalItens], [447, 447])
  })

  it('kg e unidade no mesmo item é recusado', async () => {
    const id = await compra([{ nome: 'Água sem gás', preco: 149, categoriaId: 11 }])
    const lida = conforme(contrato.respostaLeituraNota, await api.post(`/api/compras/${id}/nfce`, { url: LINKS.simples }))
    const agua = (await api.get<{ itens: { id: number }[] }>(`/api/compras/${id}`)).corpo.itens[0]!
    // Página simples fictícia: a linha 2 é banana em kg.
    const r = await api.post(`/api/compras/${id}/nfce/confirmar`, {
      decisoes: lida.conferencia.linhas.map((l) => ({ ordem: l.ordem, compraItemId: agua.id })),
    })
    assert.equal(r.status, 400)
  })
})
