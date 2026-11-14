// Sugestões ao digitar: nome e outros nomes (aliases).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buscarItens } from '../shared/utils/busca.ts'

const itens = [
  { nome: 'Aipim', aliases: ['Mandioca'] },
  { nome: 'Mamão', aliases: [] },
  { nome: 'Manteiga', aliases: [] },
]

describe('buscarItens', () => {
  it('acha pelo começo do nome, sem acento, antes dos parecidos', () => {
    assert.equal(buscarItens(itens, 'mam')[0]?.nome, 'Mamão')
  })

  it('acha pelo outro nome', () => {
    assert.equal(buscarItens(itens, 'mandi')[0]?.nome, 'Aipim')
  })

  it('o nome do item vem antes de um outro nome parecido', () => {
    const r = buscarItens([...itens, { nome: 'Mandioquinha', aliases: [] }], 'mandio').map((i) => i.nome)
    assert.equal(r[0], 'Mandioquinha')
  })
})
