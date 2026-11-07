// Busca de nomes de item para as sugestões ao digitar. Roda no cliente: a casa tem
// centenas de itens, não milhares.
import { normalizarNome } from './texto'

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      atual[j] = Math.min(atual[j - 1]! + 1, anterior[j]! + 1, anterior[j - 1]! + custo)
    }
    anterior = atual
  }
  return anterior[b.length]!
}

/** 0..1: quão parecidos são dois textos já normalizados. */
export function similaridade(a: string, b: string): number {
  const maior = Math.max(a.length, b.length)
  return maior === 0 ? 1 : 1 - levenshtein(a, b) / maior
}

function pontuar(nome: string, consulta: string): number {
  if (nome === consulta) return 100
  if (nome.startsWith(consulta)) return 80
  const palavras = nome.split(' ')
  if (palavras.some((p) => p.startsWith(consulta))) return 70
  if (nome.includes(consulta)) return 60
  // Erros de digitação: compara com o nome inteiro e com o início de mesmo tamanho.
  const sim = Math.max(
    similaridade(nome, consulta),
    similaridade(nome.slice(0, consulta.length), consulta),
    ...palavras.map((p) => similaridade(p, consulta)),
  )
  return sim >= 0.6 && consulta.length >= 3 ? 50 * sim : 0
}

export function buscarItens<T extends { nome: string; usos?: number }>(
  itens: T[],
  consulta: string,
  limite = 6,
): T[] {
  const q = normalizarNome(consulta)
  if (!q) return []
  return itens
    .map((item) => ({ item, pontos: pontuar(normalizarNome(item.nome), q) }))
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || (b.item.usos ?? 0) - (a.item.usos ?? 0))
    .slice(0, limite)
    .map((r) => r.item)
}
