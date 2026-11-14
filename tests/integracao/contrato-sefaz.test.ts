// Contrato com a SEFAZ-SC (falsa, com as páginas fictícias) e o fluxo da NFC-e pela API:
// o que o app consulta, como reage a cada página e o que fica guardado.
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import * as contrato from '../../shared/contratos/api.ts'
import { iniciarAmbiente, type Ambiente } from '../apoio/ambiente.ts'
import { clienteApi, conforme } from '../apoio/api.ts'
import { CHAVE_FICTICIA, CNPJ_FICTICIO, DADOS_PESSOAIS_FICTICIOS, LINKS } from '../apoio/sefaz-falsa.ts'

let amb: Ambiente
let api: ReturnType<typeof clienteApi>

before(async () => {
  amb = await iniciarAmbiente()
  api = clienteApi(amb.url)
})
after(() => amb.encerrar())
beforeEach(() => amb.limpar())

/** Compra finalizada com água (anotada a 1,49, o preço pago) e pão (fora da nota). */
async function compraAnotada() {
  const m = await api.post<{ id: number }>('/api/mercados', { nome: 'Mercado A' })
  const c = await api.post<{ id: number }>('/api/compras', { mercadoId: m.corpo.id })
  await api.post(`/api/compras/${c.corpo.id}/itens`, { nome: 'Água sem gás', categoriaId: 11, precoUnitario: 149, quantidade: 2, unidade: 'un' })
  await api.post(`/api/compras/${c.corpo.id}/itens`, { nome: 'Pão francês', categoriaId: 2, precoUnitario: 250, quantidade: 1, unidade: 'un' })
  await api.post(`/api/compras/${c.corpo.id}/finalizar`, {})
  return { compraId: c.corpo.id, mercadoId: m.corpo.id }
}

async function semDadosPessoais() {
  const linhas = await amb.sql`
    select row_to_json(c)::text as t from compra c
    union all select row_to_json(n)::text from nfce_item n
    union all select row_to_json(m)::text from mercado m
  `
  const texto = linhas.map((l) => l.t as string).join('\n')
  for (const pessoal of DADOS_PESSOAIS_FICTICIOS) assert.ok(!texto.includes(pessoal), `"${pessoal}" foi para o banco`)
}

describe('link do QR', () => {
  it('não consulta a SEFAZ: guarda a chave e pede a verificação no navegador', async () => {
    const { compraId } = await compraAnotada()
    const r = conforme(contrato.respostaLeituraNota, await api.post(`/api/compras/${compraId}/nfce`, { url: LINKS.qr }))
    assert.equal(r.resultado, 'verificacao')
    assert.equal(r.conferencia.estado, 'pendente')
    assert.equal(r.conferencia.chave, CHAVE_FICTICIA)
    assert.deepEqual(amb.sefaz.chamadas, [], 'o link do QR não pode ser consultado')
    const [m] = await amb.sql`select cnpj from mercado`
    assert.equal(m!.cnpj, CNPJ_FICTICIO, 'o CNPJ vem da chave do QR')
  })

  it('recusa link de outro host', async () => {
    const { compraId } = await compraAnotada()
    const r = await api.post(`/api/compras/${compraId}/nfce`, { url: 'https://exemplo.com/nfce?rq=simples' })
    assert.equal(r.status, 400)
  })
})

describe('página simples', () => {
  it('lê os itens; o desconto da água sai do preço anotado e o resto fica sem item', async () => {
    const { compraId } = await compraAnotada()
    const r = conforme(contrato.respostaLeituraNota, await api.post(`/api/compras/${compraId}/nfce`, { url: LINKS.simples }))
    assert.equal(r.resultado, 'ok')
    assert.deepEqual(amb.sefaz.chamadas, ['/tax.NET/Sat.DFe.NFCe.Web/Consultas/NFCe_Detalhes.aspx?rq=simples'])
    const c = r.conferencia
    assert.equal(c.estado, 'lida')
    assert.equal(c.aPagar, 3791)
    const agua = c.linhas.find((l) => l.ordem === 1)!
    assert.ok(agua.compraItemId, 'a água casa com a anotada')
    // Nota: 2 × 1,69 = 3,38; anotado 2 × 1,49 = 2,98 → desconto 0,40, que é todo o da nota.
    assert.deepEqual([agua.descontoNota, agua.desconto, agua.pago], [null, 40, 298])
    assert.equal(c.descontoSemItem, 0)
    await semDadosPessoais()
  })

  it('confirma: preço pago, preço cheio e total da nota; o código do produto fica aprendido', async () => {
    const { compraId } = await compraAnotada()
    const lida = conforme(contrato.respostaLeituraNota, await api.post(`/api/compras/${compraId}/nfce`, { url: LINKS.simples }))
    const decisoes = lida.conferencia.linhas.map((l) =>
      l.compraItemId ? { ordem: l.ordem, compraItemId: l.compraItemId } : { ordem: l.ordem, ignorar: true },
    )
    const pao = lida.conferencia.anotadosSemPar
    const conf = conforme(
      contrato.conferenciaNota,
      await api.post(`/api/compras/${compraId}/nfce/confirmar`, { decisoes, remover: pao }),
    )
    assert.equal(conf.estado, 'conferida')
    const resumo = conforme(contrato.resumoCompra, await api.get(`/api/compras/${compraId}`))
    const agua = resumo.itens.find((i) => i.nome === 'Água sem gás')!
    assert.deepEqual([agua.quantidade, agua.precoUnitario, agua.precoCheio, agua.total], [2, 149, 169, 298])
    assert.equal(resumo.itens.length, 1, 'o pão saiu da compra')
    assert.equal(resumo.compra.totalNota, 3791)
    const [codigo] = await amb.sql`select codigo from item_codigo`
    assert.equal(codigo!.codigo, '620')
  })
})

describe('página detalhada', () => {
  it('traz o desconto de cada item', async () => {
    const { compraId } = await compraAnotada()
    const r = conforme(contrato.respostaLeituraNota, await api.post(`/api/compras/${compraId}/nfce`, { url: LINKS.detalhada }))
    assert.equal(r.resultado, 'ok')
    const agua = r.conferencia.linhas.find((l) => l.ordem === 1)!
    assert.deepEqual([agua.descontoNota, agua.desconto, agua.pago], [40, 40, 298])
    const [linha] = await amb.sql`select ean from nfce_item where ordem = 1`
    assert.equal(linha!.ean, '7890000000017')
    await semDadosPessoais()
  })
})

describe('respostas da SEFAZ que não trazem a nota', () => {
  it('verificação: fica pendente, com a mensagem', async () => {
    const { compraId } = await compraAnotada()
    const r = conforme(contrato.respostaLeituraNota, await api.post(`/api/compras/${compraId}/nfce`, { url: LINKS.verificacao }))
    assert.equal(r.resultado, 'verificacao')
    assert.equal(r.conferencia.estado, 'pendente')
    assert.ok(r.mensagem)
  })

  it('limite de consultas: avisa e não repete sozinho', async () => {
    const { compraId } = await compraAnotada()
    const r = conforme(contrato.respostaLeituraNota, await api.post(`/api/compras/${compraId}/nfce`, { url: LINKS.limite }))
    assert.equal(r.resultado, 'limite')
    assert.equal(amb.sefaz.chamadas.filter((c) => c.includes('rq=limite')).length, 1)
  })
})

describe('compra só pela nota', () => {
  it('pergunta o mercado de um CNPJ novo e cria a compra na data da emissão', async () => {
    const pergunta = await api.post<{ resultado: string; cnpj: string }>('/api/compras/nfce', { url: LINKS.simples })
    assert.equal(pergunta.corpo.resultado, 'escolher_mercado')
    assert.equal(pergunta.corpo.cnpj, CNPJ_FICTICIO)
    const criada = await api.post<{ resultado: string; compraId: number }>('/api/compras/nfce', {
      url: LINKS.simples,
      mercadoNovo: 'Mercado Exemplo',
    })
    assert.equal(criada.corpo.resultado, 'ok')
    const resumo = conforme(contrato.resumoCompra, await api.get(`/api/compras/${criada.corpo.compraId}`))
    assert.equal(resumo.compra.data, '2026-11-06')
    assert.equal(resumo.compra.origem, 'nfce')
    // A segunda chamada usou a nota do cache: no máximo uma consulta (zero se outro teste
    // já tinha lido este link no mesmo servidor).
    assert.ok(amb.sefaz.chamadas.length <= 1, `consultas: ${amb.sefaz.chamadas.length}`)
  })
})
