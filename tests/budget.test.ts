// Regras de budget semanal (docs/produto-v1.md, "Budget"). Rode com `make unit`.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evolucaoSemanas, projetarBudget, type BaseBudget } from '../shared/utils/budget.ts'
import { diaPreferidoDa, semanaDaCompra, semanaEfetiva, semanasDoCiclo } from '../shared/utils/datas.ts'

const SEXTA = 4
const SEGUNDA = 0

describe('semanaDaCompra', () => {
  it('segunda e terça são da semana corrente', () => {
    assert.equal(semanaDaCompra('2026-11-09'), '2026-11-09') // segunda
    assert.equal(semanaDaCompra('2026-11-10'), '2026-11-09') // terça
  })
  it('de quarta a domingo, da semana seguinte', () => {
    assert.equal(semanaDaCompra('2026-11-11'), '2026-11-16') // quarta
    assert.equal(semanaDaCompra('2026-11-13'), '2026-11-16') // sexta
    assert.equal(semanaDaCompra('2026-11-08'), '2026-11-09') // domingo
  })
})

describe('diaPreferidoDa', () => {
  it('sexta da janela (quarta a terça) da semana', () => {
    assert.equal(diaPreferidoDa('2026-11-16', SEXTA), '2026-11-13')
  })
  it('segunda e terça caem na própria semana', () => {
    assert.equal(diaPreferidoDa('2026-11-16', SEGUNDA), '2026-11-16')
    assert.equal(diaPreferidoDa('2026-11-16', 1), '2026-11-17')
  })
})

describe('semanasDoCiclo', () => {
  it('novembro/2026 com sexta: idas em 6, 13, 20 e 27', () => {
    const s = semanasDoCiclo('2026-11', SEXTA)
    assert.deepEqual(
      s.map((x) => [x.segunda, x.inicio, x.fim, x.diaPreferido]),
      [
        // o dia 1 (domingo) seria da semana com ida em 30/out: vai para a 1ª semana de novembro
        ['2026-11-09', '2026-11-01', '2026-11-10', '2026-11-06'],
        ['2026-11-16', '2026-11-11', '2026-11-17', '2026-11-13'],
        ['2026-11-23', '2026-11-18', '2026-11-24', '2026-11-20'],
        // a ida de sexta 27 vale para a semana de 30/11 e sai do saldo de novembro
        ['2026-11-30', '2026-11-25', '2026-11-30', '2026-11-27'],
      ],
    )
  })

  it('dezembro/2026: compra na terça dia 1 vai para a 1ª semana de dezembro', () => {
    const s = semanasDoCiclo('2026-12', SEXTA)
    assert.deepEqual(s[0], { segunda: '2026-12-07', inicio: '2026-12-01', fim: '2026-12-08', diaPreferido: '2026-12-04' })
    assert.equal(semanaEfetiva('2026-12-01', SEXTA).segunda, '2026-12-07')
  })

  it('mês que termina na quinta: compras de quarta e quinta ficam na última semana do mês', () => {
    // dez/2026 termina numa quinta (31); a sexta seguinte (1/jan) é do ciclo de janeiro
    const s = semanasDoCiclo('2026-12', SEXTA)
    const ultima = s.at(-1)!
    assert.equal(ultima.diaPreferido, '2026-12-25')
    assert.equal(ultima.fim, '2026-12-31')
    assert.equal(semanaEfetiva('2026-12-30', SEXTA).segunda, ultima.segunda)
  })

  it('cobre todos os dias do mês, sem buracos', () => {
    for (const mes of ['2026-02', '2026-11', '2026-12', '2027-03']) {
      for (const p of [0, 1, 2, 3, 4, 5, 6]) {
        const s = semanasDoCiclo(mes, p)
        assert.equal(s[0]!.inicio, `${mes}-01`)
        for (let i = 1; i < s.length; i++) assert.ok(s[i]!.inicio > s[i - 1]!.fim)
        for (const x of s) assert.equal(x.diaPreferido.slice(0, 7), mes)
      }
    }
  })
})

function base(parcial: Partial<BaseBudget>): BaseBudget {
  return {
    configurado: true,
    saldo: 0,
    gastoPeriodo: 0,
    saldoInicioPeriodo: 0,
    semana: '2026-11-09',
    inicio: '2026-11-01',
    fim: '2026-11-10',
    diaPreferido: '2026-11-06',
    fimCiclo: '2026-11-30',
    semanasRestantes: 4,
    ...parcial,
  }
}

describe('projetarBudget', () => {
  it('domingo 8/nov, saldo R$ 660 depois da ida de sexta 6: R$ 220 nas próximas 3 semanas', () => {
    const gasto = 300_00
    const p = projetarBudget(base({ saldo: 660_00, gastoPeriodo: gasto, saldoInicioPeriodo: 660_00 + gasto }))
    assert.equal(p.budget, 240_00) // (660 + 300) / 4
    assert.equal(p.restante, -60_00)
    assert.equal(p.proximasSemanas, 220_00)
    assert.equal(p.semanasDepois, 3)
  })

  it('transbordo do carrinho divide o que sobra pelas semanas seguintes', () => {
    const p = projetarBudget(base({ saldo: 880_00, saldoInicioPeriodo: 880_00 }), 280_00)
    assert.equal(p.budget, 220_00)
    assert.equal(p.excedeu, true)
    assert.equal(p.proximasSemanas, 200_00)
  })

  it('última semana do ciclo não tem próximas semanas', () => {
    const p = projetarBudget(base({ saldo: 200_00, saldoInicioPeriodo: 200_00, semanasRestantes: 1 }), 50_00)
    assert.equal(p.budget, 200_00)
    assert.equal(p.proximasSemanas, null)
    assert.equal(p.ultimoPeriodo, true)
  })
})

describe('evolucaoSemanas', () => {
  const semanas = semanasDoCiclo('2026-11', SEXTA)

  it('reconstrói o budget de cada semana a partir do saldo de agora', () => {
    // recarga de 1.200; gastos: 300 (sem. 9/11) e 240 (sem. 16/11); hoje é 18/11 (sem. 23/11)
    const gastos = new Map([
      ['2026-11-09', 300_00],
      ['2026-11-16', 240_00],
    ])
    const e = evolucaoSemanas(semanas, gastos, 660_00, '2026-11-18')
    assert.deepEqual(
      e.map((x) => [x.segunda, x.budget, x.gasto, x.situacao]),
      [
        ['2026-11-09', 300_00, 300_00, 'passada'], // 1.200 / 4
        ['2026-11-16', 300_00, 240_00, 'passada'], // 900 / 3
        ['2026-11-23', 330_00, 0, 'atual'], // 660 / 2
        ['2026-11-30', 330_00, 0, 'futura'],
      ],
    )
  })

  it('sem ajuste de saldo no ciclo, só o gasto', () => {
    const e = evolucaoSemanas(semanas, new Map([['2026-11-09', 100_00]]), null, '2026-12-05')
    assert.equal(e[0]!.budget, null)
    assert.equal(e[0]!.gasto, 100_00)
    assert.ok(e.every((x) => x.situacao === 'passada'))
  })
})
