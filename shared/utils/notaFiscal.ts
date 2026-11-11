// NFC-e: tipos da nota lida e os links da SEFAZ-SC (docs/produto-v1.md, "Nota fiscal
// (NFC-e)"). A leitura da página fica no servidor (server/utils/paginaNfce.ts).

export interface LinhaNotaLida {
  /** Posição na nota (1, 2, …). */
  ordem: number
  /** Código do produto no cadastro da loja. */
  codigo: string | null
  descricao: string
  quantidade: number
  /** Unidade comercial como vem na nota: UN, KG, PCT, BDJ… */
  unidade: string
  /** Preço cheio da unidade, em centavos. */
  unitario: number
  /** Valor da linha antes do desconto (quantidade × unitário). */
  total: number
  /** Desconto da linha; null = a nota não diz (página simples com desconto e várias linhas). */
  desconto: number | null
  /** Código de barras (EAN/GTIN), quando a nota traz. */
  ean: string | null
}

export interface NotaLida {
  chave: string
  cnpj: string
  emitente: string
  /** ISO 8601 com fuso de SP. */
  emitidaEm: string | null
  numero: number | null
  serie: number | null
  /** Soma dos itens antes dos descontos, em centavos. */
  total: number
  desconto: number
  /** O que foi pago (total − descontos). */
  aPagar: number
  itens: LinhaNotaLida[]
}

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
 * sempre o manda para uma verificação de segurança; só as páginas que o navegador abre
 * depois dela (`...?rq=...`) o servidor lê.
 */
export function ehLinkDoQr(url: string): boolean {
  return /\/nfce\/consulta\b[^#]*[?&]p=/i.test(url)
}

/** Pago na linha: valor − desconto (desconto desconhecido conta como zero). */
export function pagoNaLinha(linha: { total: number; desconto: number | null }): number {
  return linha.total - (linha.desconto ?? 0)
}
