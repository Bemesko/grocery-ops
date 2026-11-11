// Leitura da página de consulta pública da NFC-e (layout nacional do DANFE NFC-e, usado
// pela SEFAZ-SC). Função pura: o servidor busca a página (server/utils/nfce.ts) e só o
// que sai daqui é guardado. O bloco "Consumidor" (CPF, nome, endereço) é cortado antes
// de qualquer leitura e nunca sai desta função.
import { lerChave } from './chaveNfce.ts'
import { parseDinheiro, parseNumero } from './texto.ts'

export interface LinhaNotaLida {
  /** Posição na nota (1, 2, …). */
  ordem: number
  /** Código do produto no cadastro da loja. */
  codigo: string | null
  descricao: string
  quantidade: number
  /** Unidade comercial como vem na nota: UN, KG, PCT, BDJ… */
  unidade: string
  /** Centavos. */
  unitario: number
  total: number
}

export interface NotaLida {
  chave: string
  cnpj: string
  emitente: string
  /** ISO 8601 com fuso de SP. */
  emitidaEm: string | null
  numero: number | null
  serie: number | null
  /** Soma dos itens, em centavos. */
  total: number
  desconto: number
  /** O que foi pago (total − descontos). */
  aPagar: number
  itens: LinhaNotaLida[]
}

export type PaginaNfce =
  | { tipo: 'nota'; nota: NotaLida }
  /** Verificação de segurança (captcha): o servidor não consegue ler. */
  | { tipo: 'verificacao' }
  /** "Número excessivo de requisições deste IP". */
  | { tipo: 'limite' }
  | { tipo: 'desconhecida' }

/**
 * Primeiro link da SEFAZ-SC num texto qualquer: o Compartilhar do Android manda "título +
 * link", e a colagem pode vir com texto junto. Sempre https.
 */
export function urlNfceDoTexto(texto: unknown): string | null {
  if (typeof texto !== 'string' || texto.length > 4000) return null
  const m = /https?:\/\/sat\.sef\.sc\.gov\.br\/[^\s"'<>]+/i.exec(texto)
  if (!m) return null
  try {
    const url = new URL(m[0])
    url.protocol = 'https:'
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Link impresso no QR (formato nacional `.../nfce/consulta?p=<chave>|...`). A SEFAZ-SC
 * sempre o manda para uma verificação de segurança; só o link da página da nota, que o
 * navegador recebe depois da verificação (`NFCe_Detalhes.aspx?rq=...`), o servidor lê.
 */
export function ehLinkDoQr(url: string): boolean {
  return /\/nfce\/consulta\b[^#]*[?&]p=/i.test(url)
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodificar(texto: string): string {
  return texto.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (inteira, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))
      return Number.isFinite(n) ? String.fromCodePoint(n) : inteira
    }
    return ENTIDADES[e.toLowerCase()] ?? inteira
  })
}

/** Texto de um trecho de HTML: sem tags, entidades decodificadas, espaços colapsados. */
function textoDe(html: string | undefined): string {
  return decodificar((html ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** Conteúdo do primeiro elemento com a classe, até o fechamento da mesma tag (sem aninhar). */
function classe(html: string, nome: string, tag = 'span'): string | undefined {
  const re = new RegExp(`<${tag}[^>]*class="(?:[^"]*\\s)?${nome}(?:\\s[^"]*)?"[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  return re.exec(html)?.[1]
}

/** Valor depois do rótulo em <strong> (ex.: `<strong>Qtde.:</strong>1`). */
function semRotulo(html: string | undefined): string {
  return textoDe((html ?? '').replace(/<strong>[\s\S]*?<\/strong>/gi, ''))
}

export function detectarPagina(html: string, url = ''): PaginaNfce['tipo'] {
  if (/MaximoRequisicoesExcedidas/i.test(url) || /n[úu]mero excessivo de requisi/i.test(html)) return 'limite'
  if (/SecurityVerify/i.test(url) || /cf-turnstile|Verifica[çc][ãa]o para prosseguimento/i.test(html)) {
    return 'verificacao'
  }
  return /id="tabResult"/i.test(html) ? 'nota' : 'desconhecida'
}

function emissao(html: string): string | null {
  const m = /Emiss[ãa]o:\s*<\/strong>\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/i.exec(html)
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}-03:00` : null
}

function totais(html: string): Map<string, number> {
  const valores = new Map<string, number>()
  const bloco = /<div[^>]*id="totalNota"[^>]*>([\s\S]*?)<div[^>]*id="infos"/i.exec(html)?.[1] ?? ''
  for (const m of bloco.matchAll(/<label[^>]*>([\s\S]*?)<\/label>\s*<span[^>]*class="totalNumb[^"]*"[^>]*>([^<]*)</gi)) {
    const rotulo = textoDe(m[1]).toLowerCase()
    const valor = parseDinheiro(textoDe(m[2]))
    if (valor !== null && !valores.has(rotulo)) valores.set(rotulo, valor)
  }
  return valores
}

function itens(html: string): LinhaNotaLida[] {
  const tabela = /<table[^>]*id="tabResult"[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1] ?? ''
  const linhas: LinhaNotaLida[] = []
  for (const m of tabela.matchAll(/<tr[^>]*id="Item\s*\+\s*(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tr = m[2]!
    const quantidade = parseNumero(semRotulo(classe(tr, 'Rqtd')))
    const unitario = parseDinheiro(semRotulo(classe(tr, 'RvlUnit')))
    const total = parseDinheiro(textoDe(classe(tr, 'valor')))
    const descricao = textoDe(classe(tr, 'txtTit'))
    if (!descricao || !quantidade || unitario === null || total === null) continue
    const codigo = /C[óo]digo:\s*([^)\s]+)/i.exec(textoDe(classe(tr, 'RCod')))?.[1] ?? null
    linhas.push({
      ordem: Number(m[1]),
      codigo,
      descricao,
      quantidade: Math.round(quantidade * 1000) / 1000,
      unidade: semRotulo(classe(tr, 'RUN')).toUpperCase() || 'UN',
      unitario,
      total,
    })
  }
  return linhas
}

/** Lê a página devolvida pela consulta (o HTML e a URL final, depois dos redirecionamentos). */
export function lerPaginaNfce(htmlCompleto: string, url = ''): PaginaNfce {
  const tipo = detectarPagina(htmlCompleto, url)
  if (tipo !== 'nota') return { tipo } as PaginaNfce
  // Tudo do bloco do consumidor em diante fica de fora.
  const html = htmlCompleto.split(/<h4>\s*Consumidor/i)[0]!
  const chave = lerChave(textoDe(classe(html, 'chave')))
  const linhas = itens(html)
  if (!chave || !linhas.length) return { tipo: 'desconhecida' }
  const t = totais(html)
  const total = t.get('valor total r$:') ?? linhas.reduce((s, l) => s + l.total, 0)
  const desconto = t.get('descontos r$:') ?? 0
  const cnpj = /CNPJ:\s*([\d./-]{14,18})/i.exec(textoDe(html.slice(0, html.search(/id="tabResult"/i))))?.[1]
  return {
    tipo: 'nota',
    nota: {
      chave: chave.chave,
      cnpj: cnpj?.replace(/\D/g, '') || chave.cnpj,
      emitente: textoDe(classe(html, 'txtTopo', 'div')) || 'Emitente',
      emitidaEm: emissao(html),
      numero: Number(/N[úu]mero:\s*<\/strong>\s*(\d+)/i.exec(html)?.[1]) || chave.numero,
      serie: Number(/S[ée]rie:\s*<\/strong>\s*(\d+)/i.exec(html)?.[1]) || chave.serie,
      total,
      desconto,
      aPagar: t.get('valor a pagar r$:') ?? total - desconto,
      itens: linhas,
    },
  }
}
