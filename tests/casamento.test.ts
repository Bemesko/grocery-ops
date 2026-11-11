// Casamento das linhas da NFC-e com os itens anotados na compra.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  casarNota,
  embalagemDaDescricao,
  nomeDaDescricao,
  palavrasDaDescricao,
  precoConferido,
  unidadeDaNota,
  type ItemAnotado,
} from '../shared/utils/casamento.ts'
import type { LinhaNotaLida } from '../shared/utils/notaFiscal.ts'

const linha = (
  ordem: number,
  descricao: string,
  unitario: number,
  quantidade = 1,
  codigo: string | null = null,
  desconto = 0,
): LinhaNotaLida => ({
  ordem,
  codigo,
  descricao,
  quantidade,
  unidade: 'UN',
  unitario,
  total: Math.round(unitario * quantidade),
  desconto,
  ean: null,
})

const anotado = (id: number, nome: string, precoUnitario: number, extra: Partial<ItemAnotado> = {}): ItemAnotado => ({
  id,
  itemId: id * 10,
  nome,
  variante: null,
  quantidade: 1,
  precoUnitario,
  embalagem: null,
  ...extra,
})

describe('descrição da nota', () => {
  it('expande abreviações e tira embalagem e palavras vazias', () => {
    assert.deepEqual(palavrasDaDescricao('AGUA MINERAL MARCA X 500ML S GAS PET'), ['agua', 'mineral', 'marca', 'x', 'sem', 'gas'])
    assert.deepEqual(palavrasDaDescricao('LTE INTEG TIPO A 1L'), ['leite', 'integ', 'tipo', 'a'])
  })

  it('lê a embalagem e sugere um nome', () => {
    assert.deepEqual(embalagemDaDescricao('AGUA 500ML S GAS'), { qtd: 500, unidade: 'ml' })
    assert.deepEqual(embalagemDaDescricao('ARROZ TIPO 1 5KG'), { qtd: 5, unidade: 'kg' })
    assert.equal(embalagemDaDescricao('BANANA PRATA'), null)
    assert.equal(nomeDaDescricao('LTE INTEG TIPO A 1L'), 'Leite integ tipo a')
  })

  it('KG vira kg; o resto, un', () => {
    assert.equal(unidadeDaNota('KG'), 'kg')
    assert.equal(unidadeDaNota('PCT'), 'un')
  })
})

describe('casarNota', () => {
  it('água sem gás anotada a 1,49 (pago) casa com a linha de 1,69 − 0,20 da nota', () => {
    const c = casarNota(
      [linha(1, 'AGUA MINERAL MARCA X 500ML S GAS PET', 169, 1, null, 20)],
      [anotado(1, 'Água sem gás', 149)],
      new Map(),
    )
    assert.deepEqual(
      c.pares.map((p) => [p.ordem, p.compraItemId, p.nivel]),
      [[1, 1, 'certo']],
    )
    assert.deepEqual([c.linhasSemPar, c.anotadosSemPar], [[], []])
  })

  it('abreviação da nota casa com o nome anotado (integ → integral)', () => {
    const c = casarNota(
      [linha(1, 'LTE INTEG TIPO A 1L', 459, 6), linha(2, 'BANANA PRATA KG', 599)],
      [anotado(1, 'Banana', 599), anotado(2, 'Leite integral', 459, { quantidade: 6 })],
      new Map(),
    )
    assert.deepEqual(
      c.pares.map((p) => [p.ordem, p.compraItemId]),
      [
        [1, 2],
        [2, 1],
      ],
    )
  })

  it('código já confirmado no mercado casa direto, mesmo com nome diferente', () => {
    const c = casarNota([linha(1, 'PROD 123 XYZ', 500, 1, '620')], [anotado(1, 'Água sem gás', 149)], new Map([['620', 10]]))
    assert.deepEqual(c.pares, [{ ordem: 1, compraItemId: 1, nivel: 'certo', pontos: 2 }])
  })

  it('parecido mas incerto vira sugerido; sem nada em comum fica sem par dos dois lados', () => {
    const c = casarNota(
      [linha(1, 'QUEIJO PRATO FATIADO', 1200), linha(2, 'SACOLA PLASTICA', 10)],
      [anotado(1, 'Queijo mussarela', 1500), anotado(2, 'Detergente', 249)],
      new Map(),
    )
    assert.deepEqual(
      c.pares.map((p) => [p.ordem, p.compraItemId, p.nivel]),
      [[1, 1, 'sugerido']],
    )
    assert.deepEqual(c.linhasSemPar, [2])
    assert.deepEqual(c.anotadosSemPar, [2])
  })

  it('cada item anotado só entra num par', () => {
    const c = casarNota([linha(1, 'TOMATE KG', 699), linha(2, 'TOMATE CEREJA BDJ', 599)], [anotado(1, 'Tomate', 699)], new Map())
    assert.equal(c.pares.length, 1)
    assert.equal(c.pares[0]!.ordem, 1)
    assert.deepEqual(c.linhasSemPar, [2])
  })
})

describe('precoConferido', () => {
  it('com desconto: pago exato no total, preço pago e o cheio da nota', () => {
    assert.deepEqual(precoConferido({ unitario: 169, total: 169, desconto: 20, quantidade: 1 }), {
      preco: 149,
      precoCheio: 169,
      total: 149,
    })
    assert.deepEqual(precoConferido({ unitario: 299, total: 897, desconto: 50, quantidade: 3 }), {
      preco: 282,
      precoCheio: 299,
      total: 847,
    })
  })

  it('sem desconto, vale o unitário; um cheio anotado maior fica', () => {
    assert.deepEqual(precoConferido({ unitario: 459, total: 2754, desconto: 0, quantidade: 6 }), {
      preco: 459,
      precoCheio: null,
      total: 2754,
    })
    assert.deepEqual(precoConferido({ unitario: 459, total: 459, desconto: 0, quantidade: 1 }, 599), {
      preco: 459,
      precoCheio: 599,
      total: 459,
    })
  })
})
