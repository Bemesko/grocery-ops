// Tamanho da embalagem (docs/produto-v1.md, "Embalagem e reduflação"): permite comparar
// preços por kg, litro ou unidade de conteúdo e perceber quando o pacote encolhe.

export type UnidadeEmbalagem = 'g' | 'kg' | 'ml' | 'l' | 'un'
export type BaseEmbalagem = 'kg' | 'l' | 'un'

export interface Embalagem {
  qtd: number
  unidade: UnidadeEmbalagem
}

const SINONIMOS: Record<string, UnidadeEmbalagem> = {
  g: 'g',
  gr: 'g',
  grs: 'g',
  grama: 'g',
  gramas: 'g',
  kg: 'kg',
  kgs: 'kg',
  quilo: 'kg',
  quilos: 'kg',
  ml: 'ml',
  l: 'l',
  lt: 'l',
  lts: 'l',
  litro: 'l',
  litros: 'l',
  un: 'un',
  und: 'un',
  unid: 'un',
  unidade: 'un',
  unidades: 'un',
  u: 'un',
}

/** "800 g", "1kg", "1,5 L", "500ml", "12 un", "12" (= 12 un). Inválido → null. */
export function lerEmbalagem(texto: string | null | undefined): Embalagem | null {
  if (!texto) return null
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z]*)\.?\s*$/.exec(texto)
  if (!m) return null
  const qtd = Number(m[1]!.replace(',', '.'))
  const unidade = m[2] ? SINONIMOS[m[2].toLowerCase()] : 'un'
  if (!unidade || !Number.isFinite(qtd) || qtd <= 0) return null
  return { qtd: Math.round(qtd * 1000) / 1000, unidade }
}

export function formatarEmbalagem(e: Embalagem | null | undefined): string {
  if (!e) return ''
  const n = e.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return `${n} ${e.unidade === 'l' ? 'L' : e.unidade}`
}

export function baseDe(u: UnidadeEmbalagem): BaseEmbalagem {
  return u === 'g' || u === 'kg' ? 'kg' : u === 'ml' || u === 'l' ? 'l' : 'un'
}

/** Conteúdo em kg, litros ou unidades. */
export function conteudoBase(e: Embalagem): number {
  return e.unidade === 'g' || e.unidade === 'ml' ? e.qtd / 1000 : e.qtd
}

/** Preço (centavos) por kg, litro ou unidade de conteúdo. */
export function precoBase(precoCentavos: number, e: Embalagem): number {
  return Math.round(precoCentavos / conteudoBase(e))
}

export function rotuloBase(b: BaseEmbalagem): string {
  return b === 'kg' ? '/kg' : b === 'l' ? '/L' : '/un'
}

export function mesmaBase(a: Embalagem | null | undefined, b: Embalagem | null | undefined): boolean {
  return Boolean(a && b && baseDe(a.unidade) === baseDe(b.unidade))
}

export function mesmoConteudo(a: Embalagem, b: Embalagem): boolean {
  return mesmaBase(a, b) && Math.abs(conteudoBase(a) - conteudoBase(b)) < 1e-9
}

export interface Reduflacao {
  de: Embalagem
  para: Embalagem
  /** Variação do preço por kg/L/un (positiva). */
  percentual: number
}

/**
 * Reduflação: a embalagem encolheu e o preço por conteúdo subiu (≥ 1%). Se o preço caiu na
 * mesma proporção do conteúdo, não é reduflação.
 */
export function detectarReduflacao(
  anterior: { preco: number; embalagem: Embalagem | null },
  atual: { preco: number; embalagem: Embalagem | null },
): Reduflacao | null {
  const de = anterior.embalagem
  const para = atual.embalagem
  if (!de || !para || !mesmaBase(de, para) || anterior.preco <= 0) return null
  if (conteudoBase(para) >= conteudoBase(de)) return null
  const antes = precoBase(anterior.preco, de)
  const depois = precoBase(atual.preco, para)
  const percentual = (depois - antes) / antes
  return percentual >= 0.01 ? { de, para, percentual } : null
}

/** Colunas `embalagem_qtd` + `embalagem_unidade` do banco → Embalagem. */
export function embalagemDe(qtd: unknown, unidade: unknown): Embalagem | null {
  return typeof qtd === 'number' && typeof unidade === 'string' ? { qtd, unidade: unidade as UnidadeEmbalagem } : null
}
