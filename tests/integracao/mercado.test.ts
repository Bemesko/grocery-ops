// Integração: preço informado depois (#52) e unidades de itens por kg (#51).
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

async function mercado(nome: string) {
  return (await api.post<{ id: number }>('/api/mercados', { nome })).corpo.id
}

async function compraCom(mercadoId: number, linhas: Record<string, unknown>[], finalizar = true) {
  const c = await api.post<{ id: number }>('/api/compras', { mercadoId })
  for (const l of linhas) {
    const r = await api.post(`/api/compras/${c.corpo.id}/itens`, { categoriaId: 1, quantidade: 1, unidade: 'un', ...l })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
  }
  if (finalizar) await api.post(`/api/compras/${c.corpo.id}/finalizar`, {})
  return c.corpo.id
}

describe('preço depois', () => {
  it('entra pela estimativa de outro mercado, marcado, e não vira referência', async () => {
    const a = await mercado('Mercado A')
    const b = await mercado('Mercado B')
    await compraCom(a, [{ nome: 'Manga', precoUnitario: 450 }])
    const id = await compraCom(b, [{ nome: 'Manga', precoPendente: true, quantidade: 2 }], false)

    const atual = conforme(contrato.respostaCompraAtual, await api.get('/api/compras/atual'))
    const manga = atual.itens[0]!
    assert.deepEqual([manga.precoPendente, manga.precoUnitario, manga.total], [true, 450, 900])

    await api.post(`/api/compras/${id}/finalizar`, {})
    // A referência do item no mercado B não pode ser a estimativa.
    const itens = await api.get<{ nome: string; precos: Record<string, { preco: number }> }[]>('/api/itens')
    const precos = itens.corpo.find((i) => i.nome === 'Manga')!.precos
    assert.deepEqual(Object.keys(precos), [String(a)])
  })

  it('sem referência nenhuma, entra a 0; informar o preço tira a marca', async () => {
    const a = await mercado('Mercado A')
    const id = await compraCom(a, [{ nome: 'Jaca', precoPendente: true }], false)
    const atual = await api.get<{ itens: { id: number; precoUnitario: number; precoPendente: boolean }[] }>('/api/compras/atual')
    const linha = atual.corpo.itens[0]!
    assert.deepEqual([linha.precoUnitario, linha.precoPendente], [0, true])

    await api.patch(`/api/compras/${id}/itens/${linha.id}`, { precoUnitario: 1290 })
    const resumo = conforme(contrato.resumoCompra, await api.get(`/api/compras/${id}`))
    const jaca = resumo.itens[0]!
    assert.deepEqual([jaca.precoUnitario, jaca.precoPendente, jaca.total], [1290, false, 1290])
  })

  it('sem preço e sem marcar "depois" continua recusado', async () => {
    const a = await mercado('Mercado A')
    const c = await api.post<{ id: number }>('/api/compras', { mercadoId: a })
    const r = await api.post(`/api/compras/${c.corpo.id}/itens`, { nome: 'Caqui', categoriaId: 1, quantidade: 1, unidade: 'un' })
    assert.equal(r.status, 400)
  })
})

describe('unidades em kg', () => {
  it('guarda as unidades só para itens por kg', async () => {
    const a = await mercado('Mercado A')
    const id = await compraCom(a, [
      { nome: 'Manga', unidade: 'kg', quantidade: 0.9, precoUnitario: 799, unidades: 2 },
      { nome: 'Coco', unidade: 'un', quantidade: 1, precoUnitario: 500, unidades: 3 },
    ])
    const resumo = conforme(contrato.resumoCompra, await api.get(`/api/compras/${id}`))
    const porNome = Object.fromEntries(resumo.itens.map((i) => [i.nome, i]))
    assert.deepEqual([porNome.Manga!.unidades, porNome.Manga!.total], [2, Math.round(0.9 * 799)])
    assert.equal(porNome.Coco!.unidades, null)
  })
})
