// Modo "ocultar valores" no formatarDinheiro. Rode com `make unit`.
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { DINHEIRO_OCULTO, definirOcultarDinheiro, formatarDinheiro } from '../shared/utils/texto.ts'

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
