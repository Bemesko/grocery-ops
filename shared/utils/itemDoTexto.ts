// Acha, entre os itens do app, o que corresponde a um texto livre (um item dito para a
// Alexa, por exemplo): nome igual ignorando acento e maiúsculas, ou quase igual (plural,
// erro de digitação). null = item novo.
import { similaridade } from './busca.ts'
import { normalizarNome } from './texto.ts'

export const SIMILARIDADE_MINIMA = 0.85

/** Plural simples: tira o "s" final de cada palavra ("tomates" → "tomate"). */
function singular(nome: string): string {
  return nome
    .split(' ')
    .map((p) => (p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p))
    .join(' ')
}

export function itemParaTexto<T extends { nome: string }>(texto: string, itens: T[]): T | null {
  const alvo = normalizarNome(texto)
  if (!alvo) return null
  const exato = itens.find((i) => normalizarNome(i.nome) === alvo)
  if (exato) return exato
  let melhor: { item: T; nota: number } | null = null
  for (const item of itens) {
    const nome = normalizarNome(item.nome)
    const nota = singular(nome) === singular(alvo) ? 1 : similaridade(nome, alvo)
    if (nota >= SIMILARIDADE_MINIMA && (!melhor || nota > melhor.nota)) melhor = { item, nota }
  }
  return melhor?.item ?? null
}
