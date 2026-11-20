// Integração: saldo do VR, orçamento semanal e gastos (mês, trimestre, semana a semana).
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import * as contrato from '../../shared/contratos/api.ts'
import { iniciarAmbiente, type Ambiente } from '../apoio/ambiente.ts'
import { hojeSP, inicioDoDiaSP, somarDias } from '../../shared/utils/datas.ts'
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

  it('saldo com data passada (#13): a recarga do dia 1 do mês anterior monta o orçamento × gasto dele', async () => {
    const hoje = hojeSP()
    const mesAnterior = somarDias(`${hoje.slice(0, 7)}-01`, -1).slice(0, 7)
    const r = await api.post('/api/saldo', { saldo: 80_000, dia: `${mesAnterior}-01` })
    assert.equal(r.status, 200)
    const s = conforme(contrato.saldo, await api.get('/api/saldo'))
    assert.equal(new Date(s.ajustes[0]!.em).getTime(), inicioDoDiaSP(`${mesAnterior}-01`).getTime())

    // Compra do dia 10 daquele mês (como a importação deixaria).
    const id = await compraFinalizada(12_000)
    assert.equal((await api.patch(`/api/compras/${id}`, { data: `${mesAnterior}-10` })).status, 200)
    const g = conforme(contrato.gastos, await api.get(`/api/gastos?periodo=${mesAnterior}`))
    const semanas = g.semanas!
    assert.ok(semanas.every((x) => x.budget !== null && x.situacao === 'passada'))
    assert.equal(
      semanas.reduce((t, x) => t + x.gasto, 0),
      12_000,
    )
    const doDia10 = semanas.find((x) => x.inicio <= `${mesAnterior}-10` && `${mesAnterior}-10` <= x.fim)!
    assert.equal(doDia10.gasto, 12_000)
    // A primeira semana tem a parte dela dos 80.000 (o saldo antes de qualquer compra).
    assert.ok(Math.abs(semanas[0]!.budget! - 80_000 / semanas.length) <= 1)
    // Sem ajuste mais novo, o saldo de agora é o do dia 1 menos o que se gastou desde então.
    assert.equal(s.budget.saldo, 80_000)
    assert.equal(conforme(contrato.saldo, await api.get('/api/saldo')).budget.saldo, 80_000 - 12_000)
  })

  it('saldo com data: dia de hoje vale agora; futuro e inválido são recusados', async () => {
    const hoje = hojeSP()
    assert.equal((await api.post('/api/saldo', { saldo: 1_000, dia: somarDias(hoje, 1) })).status, 400)
    assert.equal((await api.post('/api/saldo', { saldo: 1_000, dia: '2026-02-30' })).status, 400)
    const antes = Date.now()
    assert.equal((await api.post('/api/saldo', { saldo: 1_000, dia: hoje })).status, 200)
    const s = conforme(contrato.saldo, await api.get('/api/saldo'))
    assert.ok(new Date(s.ajustes[0]!.em).getTime() >= antes - 5_000)
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

  it('semestre e ano (#63): somam os meses e não têm semanas', async () => {
    await compraFinalizada(1_000)
    const ano = hojeSP().slice(0, 4)
    const mes = Number(hojeSP().slice(5, 7))
    const sem = conforme(contrato.gastos, await api.get(`/api/gastos?periodo=${ano}-S${mes <= 6 ? 1 : 2}`))
    assert.equal(sem.tipo, 'semestre')
    assert.equal(sem.porMes.length, 6)
    assert.equal(sem.total, 1_000)
    assert.equal(sem.semanas, null)
    const a = conforme(contrato.gastos, await api.get(`/api/gastos?periodo=${ano}`))
    assert.equal(a.tipo, 'ano')
    assert.equal(a.porMes.length, 12)
    assert.equal(a.total, 1_000)
  })

  it('saldo restante (#66): o saldo do ajuste menos o que foi gasto depois', async () => {
    await api.post('/api/saldo', { saldo: 50_000 })
    await compraFinalizada(1_000)
    const g = conforme(contrato.gastos, await api.get('/api/gastos'))
    assert.equal(g.saldo, 49_000)
    assert.equal(g.projecao, false)
  })

  it('mês futuro (#67): semanas projetadas pela recarga mensal, sem gasto', async () => {
    const proximo = somarDias(`${hojeSP().slice(0, 7)}-01`, 32).slice(0, 7)
    const sem = conforme(contrato.gastos, await api.get(`/api/gastos?periodo=${proximo}`))
    assert.equal(sem.projecao, true)
    assert.equal(sem.saldo, null)
    assert.ok(sem.semanas!.length >= 4)
    assert.ok(sem.semanas!.every((x) => x.budget === null && x.gasto === 0 && x.situacao === 'futura'))

    assert.equal((await api.put('/api/configuracao', { recargaMensal: 120_000 })).status, 200)
    const g = conforme(contrato.gastos, await api.get(`/api/gastos?periodo=${proximo}`))
    const n = g.semanas!.length
    assert.equal(g.saldo, 120_000)
    assert.ok(g.semanas!.every((x) => Math.abs(x.budget! - 120_000 / n) <= 1))
    // Mais de 12 meses à frente não projeta.
    const longe = conforme(contrato.gastos, await api.get(`/api/gastos?periodo=${Number(hojeSP().slice(0, 4)) + 2}-01`))
    assert.equal(longe.semanas, null)
    // Apagar a recarga.
    await api.put('/api/configuracao', { recargaMensal: 0 })
    assert.equal((await api.get<{ recargaMensal: number | null }>('/api/configuracao')).corpo.recargaMensal, null)
  })

  it('compra manual (#65): só o total, conta no saldo e aparece em "Compras sem itens"', async () => {
    await api.post('/api/saldo', { saldo: 50_000 })
    const m = await api.post<{ id: number }>('/api/mercados', { nome: 'Padaria' })
    const hoje = hojeSP()
    assert.equal((await api.post('/api/compras/manual', { mercadoId: m.corpo.id, data: somarDias(hoje, 1), total: 1_000 })).status, 400)
    assert.equal((await api.post('/api/compras/manual', { mercadoId: m.corpo.id, data: hoje, total: 0 })).status, 400)
    assert.equal((await api.post('/api/compras/manual', { mercadoId: 9_999, data: hoje, total: 1_000 })).status, 404)
    const r = await api.post<{ compraId: number }>('/api/compras/manual', { mercadoId: m.corpo.id, data: hoje, total: 4_550 })
    assert.equal(r.status, 200)

    const c = conforme(contrato.resumoCompra, await api.get(`/api/compras/${r.corpo.compraId}`))
    assert.equal(c.compra.origem, 'manual')
    assert.equal(c.compra.total, 4_550)
    assert.equal(c.itens.length, 0)
    assert.equal(c.divergencia, null)
    assert.equal(conforme(contrato.saldo, await api.get('/api/saldo')).budget.saldo, 50_000 - 4_550)

    const g = conforme(contrato.gastos, await api.get('/api/gastos'))
    assert.equal(g.total, 4_550)
    assert.equal(g.compras, 1)
    assert.deepEqual(
      g.porCategoria.map((x) => [x.categoria, x.total]),
      [['Compras sem itens', 4_550]],
    )
  })
})
