// Leitura da página detalhada da NFC-e ("Ver NFC-e detalhada", Nfe_DetalheCert.aspx), a
// única que traz o desconto e o EAN de cada item. Função pura sobre o HTML que o servidor
// busca (server/utils/nfce.ts); só o que sai daqui é guardado.
//
// A página traz os dados do destinatário (nome, CPF, endereço, telefone, e-mail). Eles são
// removidos da árvore antes de qualquer leitura, e o resto é lido só em blocos específicos
// (#Prod, #Totais, #Emitente, #NFe, #Inf), por rótulo exato.
import { parse, type HTMLElement } from 'node-html-parser'
import { lerChave } from '../../shared/utils/chaveNfce.ts'
import type { LinhaNotaLida, NotaLida } from '../../shared/utils/notaFiscal.ts'
import { parseDinheiro, parseNumero } from '../../shared/utils/texto.ts'

export type TipoPagina =
  /** Página detalhada: a que o app lê. */
  | 'detalhada'
  /** Página simples (NFCe_Detalhes.aspx): sem desconto por item; o app pede a detalhada. */
  | 'simples'
  /** Verificação de segurança (Turnstile): só o navegador passa. */
  | 'verificacao'
  /** "Número excessivo de requisições deste IP". */
  | 'limite'
  | 'desconhecida'

export type PaginaNfce = { tipo: 'detalhada'; nota: NotaLida } | { tipo: Exclude<TipoPagina, 'detalhada'> }

export function detectarPagina(html: string, url = ''): TipoPagina {
  if (/MaximoRequisicoesExcedidas/i.test(url) || /n[úu]mero excessivo de requisi/i.test(html)) return 'limite'
  if (/SecurityVerify/i.test(url) || /cf-turnstile|Verifica[çc][ãa]o para prosseguimento/i.test(html)) {
    return 'verificacao'
  }
  if (/id="Prod"/i.test(html)) return 'detalhada'
  if (/id="tabResult"/i.test(html)) return 'simples'
  return 'desconhecida'
}

const limpo = (texto: string | undefined) => (texto ?? '').replace(/\s+/g, ' ').trim()

/** Valor do `span` ao lado do `label` com exatamente este texto, dentro do bloco. */
function campo(bloco: HTMLElement | null, rotulo: string): string {
  if (!bloco) return ''
  const label = bloco.querySelectorAll('label').find((l) => limpo(l.text) === rotulo)
  return limpo(label?.nextElementSibling?.text)
}

function semDestinatario(raiz: HTMLElement) {
  raiz.querySelector('#DestRem')?.remove()
  for (const fieldset of raiz.querySelectorAll('fieldset')) {
    const legenda = fieldset.querySelector('legend')
    if (legenda && /destinat/i.test(legenda.text)) fieldset.remove()
  }
}

function itens(prod: HTMLElement): LinhaNotaLida[] {
  const linhas: LinhaNotaLida[] = []
  let atual: { cabeca: HTMLElement; detalhe?: HTMLElement } | null = null
  const pares: { cabeca: HTMLElement; detalhe?: HTMLElement }[] = []
  for (const tabela of prod.querySelectorAll('table.toggle, table.toggable')) {
    if (tabela.classList.contains('toggle')) {
      atual = { cabeca: tabela }
      pares.push(atual)
    } else if (atual && !atual.detalhe) {
      atual.detalhe = tabela
    }
  }
  for (const { cabeca, detalhe } of pares) {
    const celula = (classe: string) => limpo(cabeca.querySelector(`td.${classe}`)?.text)
    const descricao = celula('fixo-prod-serv-descricao')
    const quantidade = parseNumero(celula('fixo-prod-serv-qtd'))
    const total = parseDinheiro(celula('fixo-prod-serv-vb'))
    const unitario = parseDinheiro(campo(detalhe ?? null, 'Valor unitário de comercialização'))
    if (!descricao || !quantidade || total === null) continue
    const ean = campo(detalhe ?? null, 'Código EAN Comercial')
    linhas.push({
      ordem: Number(celula('fixo-prod-serv-numero')) || linhas.length + 1,
      codigo: campo(detalhe ?? null, 'Código do Produto') || null,
      descricao,
      quantidade: Math.round(quantidade * 1000) / 1000,
      unidade: (celula('fixo-prod-serv-uc') || 'UN').toUpperCase(),
      unitario: unitario ?? Math.round(total / quantidade),
      total,
      desconto: parseDinheiro(campo(detalhe ?? null, 'Valor do Desconto')) ?? 0,
      ean: /^\d{8,14}$/.test(ean) ? ean : null,
    })
  }
  return linhas
}

/** "18/10/2026 19:26:37-03:00" → ISO. */
function emissao(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})(?:\s*([+-]\d{2}:\d{2}))?/.exec(texto)
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}${m[5] ?? '-03:00'}` : null
}

/** Lê a página devolvida pela consulta (o HTML e a URL final, depois dos redirecionamentos). */
export function lerPaginaNfce(html: string, url = ''): PaginaNfce {
  const tipo = detectarPagina(html, url)
  if (tipo !== 'detalhada') return { tipo }
  const raiz = parse(html)
  semDestinatario(raiz)

  const prod = raiz.querySelector('#Prod')
  const linhas = prod ? itens(prod) : []
  const chave = lerChave(campo(raiz.querySelector('#Inf'), 'QR-Code'))
  const emitente = raiz.querySelector('#Emitente')
  const cnpj = campo(emitente, 'CNPJ').replace(/\D/g, '')
  if (!chave || !linhas.length) return { tipo: 'desconhecida' }

  const totais = raiz.querySelector('#Totais')
  const somaItens = linhas.reduce((s, l) => s + l.total, 0)
  const somaDescontos = linhas.reduce((s, l) => s + (l.desconto ?? 0), 0)
  const total = parseDinheiro(campo(totais, 'Valor Total dos Produtos')) ?? somaItens
  const desconto = parseDinheiro(campo(totais, 'Valor Total dos Descontos')) ?? somaDescontos
  const cabecalho = raiz.querySelector('#NFe')
  return {
    tipo: 'detalhada',
    nota: {
      chave: chave.chave,
      cnpj: cnpj.length === 14 ? cnpj : chave.cnpj,
      emitente: campo(emitente, 'Nome / Razão Social') || 'Emitente',
      emitidaEm: emissao(campo(cabecalho, 'Data de Emissão')),
      numero: Number(campo(cabecalho, 'Número')) || chave.numero,
      serie: Number(campo(cabecalho, 'Série')) || chave.serie,
      total,
      desconto,
      aPagar: parseDinheiro(campo(totais, 'Valor Total da NFe')) ?? total - desconto,
      itens: linhas,
    },
  }
}
