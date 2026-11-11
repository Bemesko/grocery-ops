// Leitura das páginas da NFC-e que o navegador abre depois da verificação da SEFAZ. Função
// pura sobre o HTML que o servidor busca (server/utils/nfce.ts); só o que sai daqui é guardado.
//
// - Página simples (NFCe_Detalhes.aspx): a que o app usa. O link dela o servidor lê de forma
//   confiável. Só traz o desconto no total: o de cada linha fica desconhecido (null) e sai
//   do preço anotado na conferência (shared/utils/casamento.ts, descontosPelosAnotados).
// - Página detalhada ("Ver NFC-e detalhada", Nfe_DetalheCert.aspx): traz desconto e EAN por
//   item, mas só abre para o navegador que acabou de passar pela verificação, por poucos
//   minutos. Se um link dela ainda válido chegar, o desconto vem exato.
//
// As duas trazem dados pessoais (consumidor/destinatário: nome, CPF, endereço e, na
// detalhada, telefone e e-mail). Esses blocos são removidos da árvore antes de qualquer
// leitura, e o resto é lido só em blocos específicos.
import { parse, type HTMLElement } from 'node-html-parser'
import { lerChave } from '../../shared/utils/chaveNfce.ts'
import type { LinhaNotaLida, NotaLida } from '../../shared/utils/notaFiscal.ts'
import { parseDinheiro, parseNumero } from '../../shared/utils/texto.ts'

export type TipoPagina =
  /** Página detalhada: desconto e EAN por item. */
  | 'detalhada'
  /** Página simples (NFCe_Detalhes.aspx): desconto só no total. */
  | 'simples'
  /** Verificação de segurança (Turnstile): só o navegador passa. */
  | 'verificacao'
  /** "Número excessivo de requisições deste IP". */
  | 'limite'
  | 'desconhecida'

export type PaginaNfce =
  | { tipo: 'nota'; pagina: 'simples' | 'detalhada'; nota: NotaLida }
  | { tipo: Exclude<TipoPagina, 'detalhada' | 'simples'> }

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
  if (tipo === 'simples') return lerSimples(html)
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
    tipo: 'nota',
    pagina: 'detalhada',
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

// --- Página simples ---------------------------------------------------------------------

/** Remove o bloco "Consumidor" (o h4 e o conteúdo ao lado) e qualquer seção com CPF. */
function semConsumidor(raiz: HTMLElement) {
  for (const h4 of raiz.querySelectorAll('h4')) {
    if (/consumidor|destinat/i.test(h4.text)) (h4.parentNode as HTMLElement | null)?.remove()
  }
}

/** Valor do `span` depois de um `<strong>Rótulo</strong>`, sem o rótulo. */
function semRotulo(no: HTMLElement | null): string {
  if (!no) return ''
  return limpo(no.childNodes.filter((n) => (n as HTMLElement).tagName !== 'STRONG').map((n) => n.text).join(' '))
}

function lerSimples(html: string): PaginaNfce {
  const raiz = parse(html)
  semConsumidor(raiz)

  const linhas: LinhaNotaLida[] = []
  for (const tr of raiz.querySelectorAll('#tabResult tr')) {
    const ordem = /^Item\s*\+\s*(\d+)$/.exec(tr.getAttribute('id') ?? '')?.[1]
    if (!ordem) continue
    const descricao = limpo(tr.querySelector('.txtTit')?.text)
    const quantidade = parseNumero(semRotulo(tr.querySelector('.Rqtd')))
    const unitario = parseDinheiro(semRotulo(tr.querySelector('.RvlUnit')))
    const total = parseDinheiro(limpo(tr.querySelector('.valor')?.text))
    if (!descricao || !quantidade || unitario === null || total === null) continue
    linhas.push({
      ordem: Number(ordem),
      codigo: /C[óo]digo:\s*([^)\s]+)/i.exec(limpo(tr.querySelector('.RCod')?.text))?.[1] ?? null,
      descricao,
      quantidade: Math.round(quantidade * 1000) / 1000,
      unidade: (semRotulo(tr.querySelector('.RUN')) || 'UN').toUpperCase(),
      unitario,
      total,
      desconto: null,
      ean: null,
    })
  }
  const chave = lerChave(limpo(raiz.querySelector('.chave')?.text))
  if (!chave || !linhas.length) return { tipo: 'desconhecida' }

  // Totais: pares rótulo → valor em #totalNota.
  const totais = new Map<string, number>()
  for (const linha of raiz.querySelectorAll('#totalNota > div')) {
    const rotulo = limpo(linha.querySelector('label')?.text).toLowerCase()
    const valor = parseDinheiro(limpo(linha.querySelector('.totalNumb')?.text))
    if (rotulo && valor !== null && !totais.has(rotulo)) totais.set(rotulo, valor)
  }
  const total = totais.get('valor total r$:') ?? linhas.reduce((s, l) => s + l.total, 0)
  const desconto = totais.get('descontos r$:') ?? 0
  // Desconto por linha: exato quando não há desconto ou a nota tem uma linha só.
  for (const l of linhas) l.desconto = desconto === 0 ? 0 : linhas.length === 1 ? desconto : null

  const topo = raiz.querySelector('.txtTopo')
  const cnpj = /CNPJ:\s*([\d./-]{14,18})/i.exec(limpo(topo?.parentNode?.text))?.[1]?.replace(/\D/g, '')
  const infos = limpo(raiz.querySelector('#infos')?.text)
  const emitida = /Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/i.exec(infos)
  return {
    tipo: 'nota',
    pagina: 'simples',
    nota: {
      chave: chave.chave,
      cnpj: cnpj?.length === 14 ? cnpj : chave.cnpj,
      emitente: limpo(topo?.text) || 'Emitente',
      emitidaEm: emitida ? `${emitida[3]}-${emitida[2]}-${emitida[1]}T${emitida[4]}-03:00` : null,
      numero: Number(/N[úu]mero:\s*(\d+)/i.exec(infos)?.[1]) || chave.numero,
      serie: Number(/S[ée]rie:\s*(\d+)/i.exec(infos)?.[1]) || chave.serie,
      total,
      desconto,
      aPagar: totais.get('valor a pagar r$:') ?? total - desconto,
      itens: linhas,
    },
  }
}
