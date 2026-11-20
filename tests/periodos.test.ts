// Períodos da tela de Gastos (shared/utils/periodos.ts). Rode com `make unit`.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { limitesDoPeriodo, mesesDoPeriodo, periodoDoMes, somarPeriodos, tipoDoPeriodo } from '../shared/utils/periodos.ts'
import { formatarConteudo } from '../shared/utils/texto.ts'

describe('períodos', () => {
  it('reconhece mês, trimestre, semestre e ano; o resto é inválido', () => {
    assert.equal(tipoDoPeriodo('2026-11'), 'mes')
    assert.equal(tipoDoPeriodo('2026-T4'), 'trimestre')
    assert.equal(tipoDoPeriodo('2026-S2'), 'semestre')
    assert.equal(tipoDoPeriodo('2026'), 'ano')
    for (const ruim of ['2026-13', '2026-T5', '2026-S3', '26', '', '2026-1']) assert.equal(tipoDoPeriodo(ruim), null, ruim)
  })

  it('limites de cada tipo', () => {
    assert.deepEqual(limitesDoPeriodo('2026-02'), { inicio: '2026-02-01', fim: '2026-02-28' })
    assert.deepEqual(limitesDoPeriodo('2026-T4'), { inicio: '2026-10-01', fim: '2026-12-31' })
    assert.deepEqual(limitesDoPeriodo('2026-S1'), { inicio: '2026-01-01', fim: '2026-06-30' })
    assert.deepEqual(limitesDoPeriodo('2026-S2'), { inicio: '2026-07-01', fim: '2026-12-31' })
    assert.deepEqual(limitesDoPeriodo('2026'), { inicio: '2026-01-01', fim: '2026-12-31' })
  })

  it('meses do período', () => {
    assert.deepEqual(mesesDoPeriodo('2026-T4'), ['2026-10', '2026-11', '2026-12'])
    assert.equal(mesesDoPeriodo('2026-S2').length, 6)
    assert.equal(mesesDoPeriodo('2026').at(-1), '2026-12')
  })

  it('navega para trás e para frente, virando o ano', () => {
    assert.equal(somarPeriodos('2026-01', -1), '2025-12')
    assert.equal(somarPeriodos('2026-12', 1), '2027-01')
    assert.equal(somarPeriodos('2026-T1', -1), '2025-T4')
    assert.equal(somarPeriodos('2026-T4', 1), '2027-T1')
    assert.equal(somarPeriodos('2026-S1', -1), '2025-S2')
    assert.equal(somarPeriodos('2026-S2', 1), '2027-S1')
    assert.equal(somarPeriodos('2026', -1), '2025')
  })

  it('período de um tipo que contém o mês', () => {
    assert.equal(periodoDoMes('2026-11', 'trimestre'), '2026-T4')
    assert.equal(periodoDoMes('2026-06', 'semestre'), '2026-S1')
    assert.equal(periodoDoMes('2026-07', 'semestre'), '2026-S2')
    assert.equal(periodoDoMes('2026-11', 'ano'), '2026')
    assert.equal(periodoDoMes('2026-11', 'mes'), '2026-11')
  })
})

describe('formatarConteudo', () => {
  it('kg e litros', () => {
    assert.equal(formatarConteudo({ qtd: 2.4, base: 'kg' }), '2,4 kg')
    assert.equal(formatarConteudo({ qtd: 6, base: 'l' }), '6 L')
  })
})
