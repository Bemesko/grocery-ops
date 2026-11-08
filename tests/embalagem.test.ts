// Embalagem e reduflação (docs/produto-v1.md). Rode com `make unit`.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  detectarReduflacao,
  formatarEmbalagem,
  lerEmbalagem,
  mesmaBase,
  precoBase,
} from '../shared/utils/embalagem.ts'

describe('lerEmbalagem', () => {
  it('entende os formatos comuns', () => {
    assert.deepEqual(lerEmbalagem('800 g'), { qtd: 800, unidade: 'g' })
    assert.deepEqual(lerEmbalagem('1kg'), { qtd: 1, unidade: 'kg' })
    assert.deepEqual(lerEmbalagem('1,5 L'), { qtd: 1.5, unidade: 'l' })
    assert.deepEqual(lerEmbalagem('500ml'), { qtd: 500, unidade: 'ml' })
    assert.deepEqual(lerEmbalagem('12 un'), { qtd: 12, unidade: 'un' })
    assert.deepEqual(lerEmbalagem('12'), { qtd: 12, unidade: 'un' })
    assert.deepEqual(lerEmbalagem('395 gr.'), { qtd: 395, unidade: 'g' })
  })
  it('recusa o que não entende', () => {
    assert.equal(lerEmbalagem(''), null)
    assert.equal(lerEmbalagem('pacote'), null)
    assert.equal(lerEmbalagem('0 g'), null)
    assert.equal(lerEmbalagem('2 caixas'), null)
  })
})

describe('formatarEmbalagem', () => {
  it('usa vírgula e L maiúsculo', () => {
    assert.equal(formatarEmbalagem({ qtd: 1.5, unidade: 'l' }), '1,5 L')
    assert.equal(formatarEmbalagem({ qtd: 800, unidade: 'g' }), '800 g')
  })
})

describe('precoBase', () => {
  it('frango: 1 kg a R$ 20 e 800 g a R$ 18 → R$ 20/kg e R$ 22,50/kg', () => {
    assert.equal(precoBase(20_00, { qtd: 1, unidade: 'kg' }), 20_00)
    assert.equal(precoBase(18_00, { qtd: 800, unidade: 'g' }), 22_50)
  })
  it('g e kg têm a mesma base; g e L não', () => {
    assert.ok(mesmaBase({ qtd: 1, unidade: 'kg' }, { qtd: 800, unidade: 'g' }))
    assert.ok(!mesmaBase({ qtd: 1, unidade: 'l' }, { qtd: 800, unidade: 'g' }))
  })
})

describe('detectarReduflacao', () => {
  const kg = { qtd: 1, unidade: 'kg' } as const
  const g800 = { qtd: 800, unidade: 'g' } as const

  it('pacote encolheu e o preço ficou igual', () => {
    const r = detectarReduflacao({ preco: 20_00, embalagem: kg }, { preco: 20_00, embalagem: g800 })
    assert.ok(r)
    assert.equal(Math.round(r.percentual * 100), 25)
  })
  it('pacote encolheu e o preço caiu na mesma proporção: não é reduflação', () => {
    assert.equal(detectarReduflacao({ preco: 20_00, embalagem: kg }, { preco: 16_00, embalagem: g800 }), null)
  })
  it('pacote cresceu: não é reduflação', () => {
    assert.equal(detectarReduflacao({ preco: 18_00, embalagem: g800 }, { preco: 20_00, embalagem: kg }), null)
  })
  it('sem embalagem em uma das compras: não dá para saber', () => {
    assert.equal(detectarReduflacao({ preco: 20_00, embalagem: null }, { preco: 20_00, embalagem: g800 }), null)
  })
})
