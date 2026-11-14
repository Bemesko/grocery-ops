// Comparação de mercados no "Preparar a ida" (docs/produto-v1.md, "Preparar a ida").
//
// Cada mercado tem preço para uma parte dos itens, então o total estimado de cada um não
// é comparável com o dos outros. A comparação é par a par: cada mercado contra o mais
// barato, só nos itens que os dois têm.

export interface MercadoComparado {
  id: number
  nome: string
}

export interface ParComparado {
  mercado: MercadoComparado
  /** Itens que os dois mercados têm. */
  itens: number
  total: number
  totalMaisBarato: number
}

export interface Comparacao {
  maisBarato: MercadoComparado
  pares: ParComparado[]
}

/**
 * O mais barato é o de menor índice de preço: a média, nos itens que ele tem e que têm
 * preço em pelo menos dois mercados, de (preço dele ÷ menor preço do item). Assim um
 * mercado não ganha só por ter preço em menos itens. Empate: o de mais itens, depois o nome.
 * Sem pelo menos dois mercados com um item em comum, não há comparação (null).
 */
export function compararMercados(
  itens: { estimativas: Record<string, number> }[],
  mercados: MercadoComparado[],
): Comparacao | null {
  const comparaveis = itens.filter((li) => mercados.filter((m) => li.estimativas[m.id] !== undefined).length >= 2)
  const indices = mercados
    .map((m) => {
      const razoes = comparaveis
        .filter((li) => li.estimativas[m.id] !== undefined)
        .map((li) => {
          const menor = Math.min(...mercados.flatMap((x) => li.estimativas[x.id] ?? []))
          return menor > 0 ? li.estimativas[m.id]! / menor : 1
        })
      return { m, n: razoes.length, indice: razoes.reduce((s, r) => s + r, 0) / (razoes.length || 1) }
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => a.indice - b.indice || b.n - a.n || a.m.nome.localeCompare(b.m.nome, 'pt-BR'))
  if (indices.length < 2) return null
  const ref = indices[0]!.m
  const pares: ParComparado[] = []
  for (const { m } of indices.slice(1)) {
    const comuns = comparaveis.filter((li) => li.estimativas[m.id] !== undefined && li.estimativas[ref.id] !== undefined)
    if (!comuns.length) continue
    pares.push({
      mercado: m,
      itens: comuns.length,
      total: comuns.reduce((s, li) => s + li.estimativas[m.id]!, 0),
      totalMaisBarato: comuns.reduce((s, li) => s + li.estimativas[ref.id]!, 0),
    })
  }
  return pares.length ? { maisBarato: ref, pares } : null
}
