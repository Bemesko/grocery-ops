// Modo "ocultar valores" no formatarDinheiro. Rode com `make unit`.
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { DINHEIRO_OCULTO, definirOcultarDinheiro, formatarDesde, formatarDinheiro, formatarDigitos } from '../shared/utils/texto.ts'

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

describe('formatarDesde (#68)', () => {
  const hoje = '2026-11-20'
  const em = (dia: string, hora = '15:00') => `${dia}T${hora}:00.000Z`

  it('hoje, ontem e há N dias', () => {
    assert.equal(formatarDesde(em('2026-11-20'), hoje), 'hoje')
    assert.equal(formatarDesde(em('2026-11-19'), hoje), 'ontem')
    assert.equal(formatarDesde(em('2026-11-17'), hoje), 'há 3 dias')
  })
  it('conta o dia de São Paulo, não o do UTC', () => {
    // 21h do dia 19 em São Paulo já é 00h do dia 20 em UTC
    assert.equal(formatarDesde(em('2026-11-20', '00:30'), hoje), 'ontem')
  })
  it('a partir de 30 dias mostra a data', () => {
    assert.equal(formatarDesde(em('2026-10-12'), hoje), 'desde 12/10')
  })
})
