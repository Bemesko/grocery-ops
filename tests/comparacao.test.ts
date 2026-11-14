// Comparação par a par dos mercados no "Preparar a ida" (#44).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compararMercados } from '../shared/utils/comparacao.ts'

const A = { id: 1, nome: 'Atacado' }
const V = { id: 2, nome: 'Variedade' }
const P = { id: 3, nome: 'Padaria' }
const item = (estimativas: Record<number, number>) => ({ estimativas })

describe('compararMercados', () => {
  it('compara cada mercado com o mais barato só nos itens que os dois têm', () => {
    const c = compararMercados(
      [
        item({ 1: 1_000, 2: 1_200 }),
        item({ 1: 500, 2: 600, 3: 550 }),
        item({ 2: 900, 3: 800 }),
        item({ 2: 300 }), // só um mercado: fica fora
      ],
      [A, V, P],
    )!
    assert.equal(c.maisBarato.nome, 'Atacado')
    assert.deepEqual(
      c.pares.map((p) => [p.mercado.nome, p.itens, p.total, p.totalMaisBarato]),
      [
        ['Padaria', 1, 550, 500],
        ['Variedade', 2, 1_800, 1_500],
      ],
    )
  })

  it('aparece mesmo quando nenhum item tem preço em todos os mercados', () => {
    const c = compararMercados([item({ 1: 1_000, 2: 900 }), item({ 2: 400, 3: 500 })], [A, V, P])!
    assert.equal(c.maisBarato.nome, 'Variedade')
    assert.deepEqual(
      c.pares.map((p) => [p.mercado.nome, p.itens]),
      [
        ['Atacado', 1],
        ['Padaria', 1],
      ],
    )
  })

  it('não ganha quem tem preço em menos itens só por isso', () => {
    // A Padaria só tem o item barato; nele, cobra mais que o Atacado.
    const c = compararMercados([item({ 1: 5_000, 2: 6_000 }), item({ 1: 100, 3: 110 })], [A, V, P])!
    assert.equal(c.maisBarato.nome, 'Atacado')
  })

  it('sem item em comum entre dois mercados, não há comparação', () => {
    assert.equal(compararMercados([item({ 1: 100 }), item({ 2: 200 })], [A, V]), null)
    assert.equal(compararMercados([item({ 1: 100, 2: 90 })], [A]), null)
    assert.equal(compararMercados([], [A, V]), null)
  })
})
