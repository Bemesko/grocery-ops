// Integração: variante na lista, outros nomes (aliases) e apagar item.
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import * as contrato from '../../shared/contratos/api.ts'
import { iniciarAmbiente, type Ambiente } from '../apoio/ambiente.ts'
import { clienteApi, conforme } from '../apoio/api.ts'

let amb: Ambiente
let api: ReturnType<typeof clienteApi>

before(async () => {
  amb = await iniciarAmbiente()
  api = clienteApi(amb.url)
})
after(() => amb.encerrar())
beforeEach(() => amb.limpar())

const HORTIFRUTI = 1

async function naLista(nome: string, categoriaId = HORTIFRUTI) {
  const r = await api.post<{ id: number; itemId: number }>('/api/lista', { nome, categoriaId })
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  return r.corpo
}

describe('variante na lista', () => {
  it('fica na linha da lista e chega ao mercado como sugestão', async () => {
    const leite = await naLista('Leite', 3)
    const r = await api.patch(`/api/lista/${leite.id}`, { variante: 'integral 1 L', quantidade: '6' })
    assert.equal(r.status, 200)
    const lista = conforme(contrato.respostaLista, await api.get('/api/lista'))
    assert.deepEqual([lista.itens[0]!.quantidade, lista.itens[0]!.variante], ['6', 'integral 1 L'])

    const m = await api.post<{ id: number }>('/api/mercados', { nome: 'Mercado A' })
    await api.post('/api/compras', { mercadoId: m.corpo.id })
    const atual = conforme(contrato.respostaCompraAtual, await api.get('/api/compras/atual'))
    assert.equal(atual.pendentes[0]!.variante, 'integral 1 L')

    await api.patch(`/api/lista/${leite.id}`, { variante: null })
    const sem = conforme(contrato.respostaLista, await api.get('/api/lista'))
    assert.equal(sem.itens[0]!.variante, null)
  })
})

describe('outros nomes (aliases)', () => {
  it('um item novo com o outro nome de um item existente vira esse item', async () => {
    const aipim = await naLista('Aipim')
    assert.equal((await api.post(`/api/itens/${aipim.itemId}/aliases`, { alias: 'mandioca' })).status, 200)
    await api.del(`/api/lista/${aipim.id}`)
    // Sem categoria: se fosse item novo, a API pediria (422).
    const r = await api.post<{ itemId: number; nome: string }>('/api/lista', { nome: 'Mandioca' })
    assert.equal(r.status, 200)
    assert.deepEqual([r.corpo.itemId, r.corpo.nome], [aipim.itemId, 'Aipim'])
    const itens = await api.get<{ id: number; aliases: string[] }[]>('/api/itens')
    assert.deepEqual(itens.corpo.find((i) => i.id === aipim.itemId)!.aliases, ['Mandioca'])
  })

  it('recusa o nome de outro item ou um outro nome já usado', async () => {
    const aipim = await naLista('Aipim')
    const batata = await naLista('Batata')
    assert.equal((await api.post(`/api/itens/${aipim.itemId}/aliases`, { alias: 'batata' })).status, 409)
    await api.post(`/api/itens/${aipim.itemId}/aliases`, { alias: 'macaxeira' })
    assert.equal((await api.post(`/api/itens/${batata.itemId}/aliases`, { alias: 'Macaxeira' })).status, 409)
    assert.equal((await api.del(`/api/itens/${aipim.itemId}/aliases?alias=macaxeira`)).status, 200)
    assert.equal((await api.post(`/api/itens/${batata.itemId}/aliases`, { alias: 'Macaxeira' })).status, 200)
  })

  it('juntar dois itens guarda o nome do que some como outro nome', async () => {
    const aipim = await naLista('Aipim')
    const mandioca = await naLista('Mandioca')
    assert.equal((await api.post(`/api/itens/${mandioca.itemId}/juntar`, { destinoId: aipim.itemId })).status, 200)
    const itens = await api.get<{ id: number; nome: string; aliases: string[] }[]>('/api/itens')
    assert.deepEqual(
      itens.corpo.map((i) => [i.nome, i.aliases]),
      [['Aipim', ['Mandioca']]],
    )
  })

  it('a lista da Alexa acha o item pelo outro nome', async () => {
    const aipim = await naLista('Aipim')
    await api.post(`/api/itens/${aipim.itemId}/aliases`, { alias: 'mandioca' })
    await api.del(`/api/lista/${aipim.id}`)
    amb.ha.itens.push({ uid: 'm1', summary: 'mandioca', status: 'needs_action' })
    conforme(contrato.estadoAlexa, await api.post('/api/alexa/sincronizar'))
    const lista = conforme(contrato.respostaLista, await api.get('/api/lista'))
    assert.deepEqual(
      lista.itens.map((i) => [i.nome, i.origem]),
      [['Aipim', 'alexa']],
    )
  })
})

describe('apagar item', () => {
  it('apaga item que só passou pela lista; recusa item que está numa compra', async () => {
    const tomate = await naLista('Tomate')
    await api.post(`/api/lista/${tomate.id}/comprado`)
    assert.equal((await api.del(`/api/itens/${tomate.itemId}`)).status, 200)

    const m = await api.post<{ id: number }>('/api/mercados', { nome: 'Mercado A' })
    const c = await api.post<{ id: number }>('/api/compras', { mercadoId: m.corpo.id })
    const linha = await api.post<{ itemId: number }>(`/api/compras/${c.corpo.id}/itens`, {
      nome: 'Cebola',
      categoriaId: HORTIFRUTI,
      precoUnitario: 499,
      quantidade: 1,
      unidade: 'un',
    })
    const recusa = await api.del<{ message: string }>(`/api/itens/${linha.corpo.itemId}`)
    assert.equal(recusa.status, 409)
    assert.match(recusa.corpo.message, /1 compra: apague a compra antes/)
  })
})
