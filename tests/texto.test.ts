// Modo "ocultar valores" no formatarDinheiro. Rode com `make unit`.
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { DINHEIRO_OCULTO, definirOcultarDinheiro, formatarDinheiro, formatarDigitos } from '../shared/utils/texto.ts'

describe('formatarDinheiro', () => {
  afterEach(() => definirOcultarDinheiro(() => false))

  it('formata em reais', () => {
    assert.equal(formatarDinheiro(66_000).replace(/\s/g, ' '), 'R$ 660,00')
  })
  it('com valores ocultos, troca por um texto de largura fixa', () => {
    definirOcultarDinheiro(() => true)
    assert.equal(formatarDinheiro(66_000), DINHEIRO_OCULTO)
    assert.equal(formatarDinheiro(5), DINHEIRO_OCULTO)
  })
  it('sem valor continua "—", oculto ou não', () => {
    assert.equal(formatarDinheiro(null), '—')
    definirOcultarDinheiro(() => true)
    assert.equal(formatarDinheiro(undefined), '—')
  })
})

describe('formatarDigitos', () => {
  it('preenche da direita para a esquerda, com casas fixas', () => {
    assert.equal(formatarDigitos('1', 2), '0,01')
    assert.equal(formatarDigitos('14', 2), '0,14')
    assert.equal(formatarDigitos('149', 2), '1,49')
    assert.equal(formatarDigitos('123456', 2), '1234,56')
    assert.equal(formatarDigitos('900', 3), '0,900')
    assert.equal(formatarDigitos('1234', 3), '1,234')
  })

  it('ignora o que não é dígito e zeros à esquerda; sem dígitos, vazio', () => {
    assert.equal(formatarDigitos('R$ 4,59', 2), '4,59')
    assert.equal(formatarDigitos('0,014', 2), '0,14')
    assert.equal(formatarDigitos('', 2), '')
    assert.equal(formatarDigitos('0,00', 2), '')
  })
})
