// Itens ditos para a Alexa → itens do app.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { itemParaTexto } from '../shared/utils/itemDoTexto.ts'

const itens = [
  { id: 1, nome: 'Tomate' },
  { id: 2, nome: 'Pão francês' },
  { id: 3, nome: 'Leite integral' },
  { id: 4, nome: 'Detergente' },
]

describe('itemParaTexto', () => {
  it('nome igual, ignorando acento e maiúsculas', () => {
    assert.equal(itemParaTexto('pao frances', itens)?.id, 2)
    assert.equal(itemParaTexto('  DETERGENTE ', itens)?.id, 4)
  })

  it('plural e erro de digitação pequeno', () => {
    assert.equal(itemParaTexto('tomates', itens)?.id, 1)
    assert.equal(itemParaTexto('leite integrall', itens)?.id, 3)
  })

  it('algo novo ou só parecido não casa', () => {
    assert.equal(itemParaTexto('abacate', itens), null)
    assert.equal(itemParaTexto('leite', itens), null)
    assert.equal(itemParaTexto('', itens), null)
  })
})
