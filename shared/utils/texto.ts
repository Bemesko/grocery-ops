// Usado no front e na API (Nuxt importa shared/utils nos dois lados).

/** Chave de comparação de nomes: minúsculo, sem acento, espaços colapsados. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nome para exibir: espaços colapsados e primeira letra maiúscula. */
export function limparNome(nome: string): string {
  const s = nome.replace(/\s+/g, ' ').trim()
  return s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1)
}

/** "1.234,56", "4,59", "4.59", "R$ 10" → número. Vírgula presente = decimal brasileiro. */
export function parseNumero(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null
  let s = texto.replace(/R\$/i, '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Texto em reais → centavos. */
export function parseDinheiro(texto: string | number | null | undefined): number | null {
  const n = parseNumero(texto)
  return n === null ? null : Math.round(n * 100)
}

/** Primeiro número de um texto livre de quantidade ("2", "1,5 kg", "3 pacotes"). */
export function quantidadeDoTexto(texto: string | null | undefined): number | null {
  const m = texto?.match(/\d+(?:[.,]\d+)?/)
  if (!m) return null
  const n = parseNumero(m[0])
  return n && n > 0 ? n : null
}

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Texto no lugar de um valor quando o modo "ocultar valores" está ligado (largura fixa). */
export const DINHEIRO_OCULTO = 'R$ •••••'

// Modo "ocultar valores" (o olho no cabeçalho): o front registra um getter que lê um ref,
// então os templates que chamam formatarDinheiro reagem ao alternar. No servidor, nunca.
let dinheiroOculto: () => boolean = () => false

export function definirOcultarDinheiro(getter: () => boolean) {
  dinheiroOculto = getter
}

export function formatarDinheiro(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '—'
  if (dinheiroOculto()) return DINHEIRO_OCULTO
  return reais.format(centavos / 100)
}

/** Centavos → texto para um campo editável ("4,59"). */
export function dinheiroParaCampo(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return ''
  return (centavos / 100).toFixed(2).replace('.', ',')
}

export function formatarQuantidade(quantidade: number, unidade: 'un' | 'kg'): string {
  if (unidade === 'kg') return `${quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
  return `${quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} un`
}

export function formatarPercentual(fracao: number, casas = 0): string {
  return `${(fracao * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`
}

/** Total de uma linha do carrinho, arredondado ao centavo como no caixa. */
export function totalItem(quantidade: number, precoUnitarioCentavos: number): number {
  return Math.round(quantidade * precoUnitarioCentavos)
}
