// Integração: saldo do VR, orçamento semanal e gastos (mês, trimestre, semana a semana).
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

async function compraFinalizada(total: number, categoriaId = 6) {
  const m = await api.post<{ id: number }>('/api/mercados', { nome: `Mercado ${total}` })
  const c = await api.post<{ id: number }>('/api/compras', { mercadoId: m.corpo.id })
  await api.post(`/api/compras/${c.corpo.id}/itens`, { nome: `Item ${total}`, categoriaId, precoUnitario: total, quantidade: 1, unidade: 'un' })
  await api.post(`/api/compras/${c.corpo.id}/finalizar`, {})
  return c.corpo.id
}

describe('saldo e orçamento', () => {
  it('sem saldo, o orçamento não está configurado', async () => {
    const s = conforme(contrato.saldo, await api.get('/api/saldo'))
    assert.equal(s.budget.configurado, false)
  })

  it('ajuste de saldo e compra depois dele: saldo cai, semana registra o gasto', async () => {
    conforme(contrato.saldo.pick({ budget: true }), await api.post('/api/saldo', { saldo: 100_000 }))
    await compraFinalizada(12_345)
    const s = conforme(contrato.saldo, await api.get('/api/saldo'))
    assert.equal(s.budget.configurado, true)
    assert.equal(s.budget.saldo, 100_000 - 12_345)
    assert.equal(s.ajustes.length, 1)
  })
})

describe('gastos', () => {
  it('mês: total, categoria, mercado e semana a semana', async () => {
    await api.post('/api/saldo', { saldo: 50_000 })
    await compraFinalizada(1_000, 6)
    await compraFinalizada(2_500, 7)
    const g = conforme(contrato.gastos, await api.get('/api/gastos'))
    assert.equal(g.tipo, 'mes')
    assert.equal(g.total, 3_500)
    assert.equal(g.compras, 2)
    assert.deepEqual(
      g.porCategoria.map((c) => [c.categoria, c.total]),
      [
        ['Limpeza', 2_500],
        ['Mercearia', 1_000],
      ],
    )
    assert.ok(g.semanas && g.semanas.length >= 4, 'semana a semana no mês')
  })

  it('trimestre: sem semanas', async () => {
    await compraFinalizada(1_000)
    const hoje = new Date().toISOString().slice(0, 7)
    const tri = `${hoje.slice(0, 4)}-T${Math.floor((Number(hoje.slice(5)) - 1) / 3) + 1}`
    const g = conforme(contrato.gastos, await api.get(`/api/gastos?periodo=${tri}`))
    assert.equal(g.tipo, 'trimestre')
    assert.equal(g.porMes.length, 3)
    assert.equal(g.semanas, null)
  })
})
