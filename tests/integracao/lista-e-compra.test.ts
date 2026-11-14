// Integração: lista e compra no mercado, pela API real com Postgres, conferindo o contrato.
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import * as contrato from '../../shared/contratos/api.ts'
import { iniciarAmbiente, type Ambiente } from '../apoio/ambiente.ts'
import { clienteApi, conforme } from '../apoio/api.ts'

const HORTIFRUTI = 1
const BEBIDAS = 11

let amb: Ambiente
let api: ReturnType<typeof clienteApi>

before(async () => {
  amb = await iniciarAmbiente()
  api = clienteApi(amb.url)
})
after(() => amb.encerrar())
beforeEach(() => amb.limpar())

async function mercado(nome = 'Mercado A') {
  const r = await api.post<{ id: number }>('/api/mercados', { nome })
  assert.equal(r.status, 200)
  return r.corpo.id
}

describe('lista', () => {
  it('adiciona item novo e existente, sem duplicar o que já está aberto', async () => {
    const novo = await api.post<{ id: number; itemId: number; jaExistia: boolean }>('/api/lista', {
      nome: 'banana prata',
      categoriaId: HORTIFRUTI,
    })
    assert.equal(novo.status, 200)
    assert.equal(novo.corpo.jaExistia, false)
    const deNovo = await api.post<{ jaExistia: boolean }>('/api/lista', { itemId: novo.corpo.itemId })
    assert.equal(deNovo.corpo.jaExistia, true)

    const lista = conforme(contrato.respostaLista, await api.get('/api/lista'))
    assert.deepEqual(
      lista.itens.map((i) => [i.nome, i.categoriaId, i.origem]),
      [['Banana prata', HORTIFRUTI, 'app']],
    )
  })

  it('item novo sem categoria pede a categoria (422)', async () => {
    const r = await api.post<{ data: { precisaCategoria: boolean } }>('/api/lista', { nome: 'algo inédito' })
    assert.equal(r.status, 422)
  })

  it('prioridade, quantidade, comprado e tirar da lista', async () => {
    const a = await api.post<{ id: number }>('/api/lista', { nome: 'Água sem gás', categoriaId: BEBIDAS })
    const b = await api.post<{ id: number }>('/api/lista', { nome: 'Tomate', categoriaId: HORTIFRUTI })
    assert.equal((await api.patch(`/api/lista/${a.corpo.id}`, { prioritario: true, quantidade: '6' })).status, 200)
    assert.equal((await api.post(`/api/lista/${a.corpo.id}/comprado`)).status, 200)
    assert.equal((await api.del(`/api/lista/${b.corpo.id}`)).status, 200)
    const lista = conforme(contrato.respostaLista, await api.get('/api/lista'))
    assert.equal(lista.itens.length, 0)
  })
})

describe('compra', () => {
  it('começa, registra itens, finaliza com o total da nota e mostra o resumo', async () => {
    const m = await mercado()
    await api.post('/api/lista', { nome: 'Leite integral', categoriaId: 3 })
    const c = await api.post<{ id: number }>('/api/compras', { mercadoId: m, levarTudo: true })
    assert.equal(c.status, 200)

    const atual = conforme(contrato.respostaCompraAtual, await api.get('/api/compras/atual'))
    assert.equal(atual.compra?.id, c.corpo.id)
    assert.deepEqual(
      atual.pendentes.map((p) => p.nome),
      ['Leite integral'],
    )

    const leite = await api.post(`/api/compras/${c.corpo.id}/itens`, {
      itemId: atual.pendentes[0]!.itemId,
      precoUnitario: 459,
      quantidade: 6,
      unidade: 'un',
    })
    assert.equal(leite.status, 200)
    const banana = await api.post(`/api/compras/${c.corpo.id}/itens`, {
      nome: 'Banana',
      categoriaId: HORTIFRUTI,
      precoUnitario: 599,
      quantidade: 1.234,
      unidade: 'kg',
    })
    assert.equal(banana.status, 200)

    const fim = conforme(contrato.resumoCompra, await api.post(`/api/compras/${c.corpo.id}/finalizar`, { totalNota: 3500 }))
    assert.equal(fim.compra.status, 'finalizada')
    assert.equal(fim.compra.total, 6 * 459 + Math.round(1.234 * 599))
    assert.equal(fim.compra.totalNota, 3500)
    assert.equal(fim.foraDaLista.quantidade, 1)

    // O item comprado sai da lista.
    const lista = conforme(contrato.respostaLista, await api.get('/api/lista'))
    assert.equal(lista.itens.length, 0)
    conforme(contrato.resumoCompra, await api.get(`/api/compras/${c.corpo.id}`))
  })

  it('só uma compra em andamento; cancelar e excluir', async () => {
    const m = await mercado()
    const c = await api.post<{ id: number }>('/api/compras', { mercadoId: m })
    assert.equal((await api.post('/api/compras', { mercadoId: m })).status, 409)
    assert.equal((await api.del(`/api/compras/${c.corpo.id}`)).status, 409, 'em andamento não se exclui')
    assert.equal((await api.post(`/api/compras/${c.corpo.id}/cancelar`)).status, 200)
    assert.equal((await api.del(`/api/compras/${c.corpo.id}`)).status, 200)
    assert.equal((await api.get(`/api/compras/${c.corpo.id}`)).status, 404)
  })
})
