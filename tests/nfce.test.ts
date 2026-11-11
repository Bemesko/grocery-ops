// Leitura da NFC-e: chave de acesso e página da consulta pública (fixture fictícia).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { digitoChave, formatarChave, lerChave } from '../shared/utils/chaveNfce.ts'
import { detectarPagina, lerPaginaNfce } from '../server/utils/paginaNfce.ts'
import { ehLinkDoQr, ehPaginaSimples, urlNfceDoTexto } from '../shared/utils/notaFiscal.ts'

const CHAVE = '42261111222333000181650010000012341123456788'
const ler = (nome: string) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf8')
const detalhada = ler('nfce-detalhada-ficticia.html')
const simples = ler('nfce-ficticia.html')

describe('lerChave', () => {
  it('confere o dígito e separa os campos', () => {
    assert.equal(digitoChave(CHAVE.slice(0, 43)), 8)
    assert.deepEqual(lerChave(CHAVE), {
      chave: CHAVE,
      uf: '42',
      mes: '2026-11',
      cnpj: '11222333000181',
      modelo: '65',
      serie: 1,
      numero: 1234,
    })
  })
  it('aceita a chave impressa, com espaços, e o QR do formato nacional', () => {
    assert.equal(lerChave(formatarChave(CHAVE))?.chave, CHAVE)
    assert.equal(lerChave(`https://sat.sef.sc.gov.br/nfce/consulta?p=${CHAVE}|2|1|1|ABCDEF`)?.chave, CHAVE)
  })
  it('recusa dígito errado e texto sem chave', () => {
    assert.equal(lerChave(`${CHAVE.slice(0, 43)}1`), null)
    assert.equal(lerChave('https://sat.sef.sc.gov.br/tax.NET/x.aspx?rq=abc123'), null)
  })
})

describe('lerPaginaNfce (página detalhada)', () => {
  const lida = lerPaginaNfce(detalhada, 'https://sat.sef.sc.gov.br/tax.NET/Sat.NFe.Web/Consultas/Nfe_DetalheCert.aspx?rq=x')
  const nota = lida.tipo === 'detalhada' ? lida.nota : null

  it('lê emitente, chave, emissão e totais', () => {
    assert.ok(nota)
    assert.equal(nota.emitente, 'MERCADO EXEMPLO DE TESTE LTDA')
    assert.equal(nota.cnpj, '11222333000181')
    assert.equal(nota.chave, CHAVE)
    assert.equal(nota.emitidaEm, '2026-11-06T18:05:09-03:00')
    assert.equal(nota.numero, 1234)
    assert.equal(nota.serie, 1)
    assert.deepEqual([nota.total, nota.desconto, nota.aPagar], [1077, 40, 1037])
  })

  it('lê cada linha com o desconto e o EAN dela', () => {
    assert.deepEqual(nota?.itens, [
      {
        ordem: 1,
        codigo: '620',
        descricao: 'AGUA MINERAL MARCA X 500ML S GAS PET',
        quantidade: 2,
        unidade: 'UN',
        unitario: 169,
        total: 338,
        desconto: 40,
        ean: '7890000000017',
      },
      {
        ordem: 2,
        codigo: '7001',
        descricao: 'BANANA PRATA KG P&B',
        quantidade: 1.234,
        unidade: 'KG',
        unitario: 599,
        total: 739,
        desconto: 0,
        ean: null,
      },
    ])
  })

  it('nada do destinatário sai da leitura', () => {
    const texto = JSON.stringify(lida)
    for (const pessoal of ['000.000.000-00', 'FULANO', 'FICTICIA', '90000-0000', 'exemplo.invalid']) {
      assert.ok(!texto.includes(pessoal), pessoal)
    }
  })
})

describe('detectarPagina', () => {
  it('separa a detalhada, a simples, a verificação e o limite', () => {
    assert.equal(detectarPagina(detalhada), 'detalhada')
    assert.equal(detectarPagina(simples), 'simples')
    assert.equal(lerPaginaNfce(simples).tipo, 'simples')
    assert.equal(detectarPagina('<div class="cf-turnstile" data-sitekey="x"></div>'), 'verificacao')
    assert.equal(detectarPagina('', 'https://sat.sef.sc.gov.br/tax.NET/SecurityVerify.aspx?rq=x'), 'verificacao')
    assert.equal(detectarPagina('O sistema detectou um número excessivo de requisições deste IP.'), 'limite')
    assert.equal(lerPaginaNfce('<html>outra coisa</html>').tipo, 'desconhecida')
  })
})

describe('links da nota', () => {
  const qr = `https://sat.sef.sc.gov.br/nfce/consulta?p=${CHAVE}|2|1|1|abcdef0123`
  const pagina = 'https://sat.sef.sc.gov.br/tax.NET/Sat.DFe.NFCe.Web/Consultas/NFCe_Detalhes.aspx?rq=abc%2Fdef%3D%3D'

  it('acha o link no texto do Compartilhar e em colagens com texto junto', () => {
    assert.equal(urlNfceDoTexto(`NFCe - Detalhes ${pagina}`), pagina)
    assert.equal(urlNfceDoTexto(`  ${pagina}
`), pagina)
    assert.equal(urlNfceDoTexto(pagina.replace('https:', 'http:')), pagina)
  })

  it('recusa outros hosts, inclusive parecidos', () => {
    assert.equal(urlNfceDoTexto('https://exemplo.com/?u=x'), null)
    assert.equal(urlNfceDoTexto('https://sat.sef.sc.gov.br.exemplo.com/nfce'), null)
    assert.equal(urlNfceDoTexto(null), null)
  })

  it('separa o link do QR (sempre pede verificação) do link da página da nota', () => {
    assert.equal(ehLinkDoQr(qr), true)
    assert.equal(ehLinkDoQr(urlNfceDoTexto(qr)!), true)
    assert.equal(ehLinkDoQr(pagina), false)
    assert.equal(ehPaginaSimples(pagina), true)
    assert.equal(ehPaginaSimples('https://sat.sef.sc.gov.br/tax.NET/Sat.NFe.Web/Consultas/Nfe_DetalheCert.aspx?rq=x'), false)
    assert.equal(lerChave(urlNfceDoTexto(qr))?.chave, CHAVE)
  })
})
