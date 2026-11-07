import type { CompraItem, PrecoReferencia, Variacao } from '../../shared/types/api'
import type { Sql } from './db'

export interface Referencia extends PrecoReferencia {
  itemId: number
  mercadoId: number
  finalizadaEm: Date
}

/**
 * Último preço de cada item em cada mercado, entre as compras finalizadas antes de
 * `antesDe` (todas, se omitido). Chave: `${itemId}:${mercadoId}`.
 */
export async function referencias(sql: Sql, antesDe?: Date): Promise<Map<string, Referencia>> {
  const linhas = await sql`
    select distinct on (ci.item_id, c.mercado_id)
      ci.item_id, c.mercado_id, ci.preco_unitario_centavos as preco, ci.quantidade, ci.variante,
      c.data, c.finalizada_em
    from compra_item ci join compra c on c.id = ci.compra_id
    where c.status = 'finalizada' ${antesDe ? sql`and c.finalizada_em < ${antesDe}` : sql``}
    order by ci.item_id, c.mercado_id, c.finalizada_em desc, ci.id desc
  `
  const mapa = new Map<string, Referencia>()
  for (const l of linhas) mapa.set(`${l.itemId}:${l.mercadoId}`, l as unknown as Referencia)
  return mapa
}

/** Referência mais recente do item fora de `mercadoId`. */
export function referenciaOutroMercado(
  refs: Map<string, Referencia>,
  itemId: number,
  mercadoId: number,
): Referencia | null {
  let melhor: Referencia | null = null
  for (const r of refs.values()) {
    if (r.itemId !== itemId || r.mercadoId === mercadoId) continue
    if (!melhor || r.finalizadaEm > melhor.finalizadaEm) melhor = r
  }
  return melhor
}

/** Quantidade comprada na última vez, em qualquer mercado. */
export async function ultimasQuantidades(sql: Sql): Promise<Map<number, number>> {
  const linhas = await sql`
    select distinct on (ci.item_id) ci.item_id, ci.quantidade
    from compra_item ci join compra c on c.id = ci.compra_id
    where c.status = 'finalizada'
    order by ci.item_id, c.finalizada_em desc, ci.id desc
  `
  return new Map(linhas.map((l) => [l.itemId as number, l.quantidade as number]))
}

/** Quantidade usada nas estimativas: a da lista, senão a última comprada, senão 1. */
export function quantidadeEstimada(textoLista: string | null, ultima: number | undefined): number {
  return quantidadeDoTexto(textoLista) ?? ultima ?? 1
}

export function variacao(
  refs: Map<string, Referencia>,
  nomesMercados: Map<number, string>,
  itemId: number,
  mercadoId: number,
  preco: number,
): Variacao | null {
  const mesmo = refs.get(`${itemId}:${mercadoId}`)
  const ref = mesmo ?? referenciaOutroMercado(refs, itemId, mercadoId)
  if (!ref || ref.preco === 0) return null
  return {
    anterior: ref.preco,
    percentual: (preco - ref.preco) / ref.preco,
    outroMercado: mesmo ? null : (nomesMercados.get(ref.mercadoId) ?? null),
  }
}

export async function nomesDosMercados(sql: Sql): Promise<Map<number, string>> {
  const linhas = await sql`select id, nome from mercado`
  return new Map(linhas.map((l) => [l.id as number, l.nome as string]))
}

/** Itens de uma compra, com a variação de preço em relação às compras anteriores a ela. */
export async function itensDaCompra(
  sql: Sql,
  compra: { id: number; mercadoId: number; finalizadaEm: Date | null },
): Promise<CompraItem[]> {
  const linhas = await sql`
    select ci.id, ci.item_id, i.nome, i.categoria_id, ci.unidade, ci.quantidade,
      ci.preco_unitario_centavos as preco_unitario, ci.preco_cheio_centavos as preco_cheio,
      ci.variante, ci.da_lista, ci.total_centavos as total
    from compra_item ci join item i on i.id = ci.item_id
    where ci.compra_id = ${compra.id}
    order by ci.id
  `
  const refs = await referencias(sql, compra.finalizadaEm ?? undefined)
  const nomes = await nomesDosMercados(sql)
  return linhas.map((l) => ({
    ...(l as unknown as CompraItem),
    variacao: variacao(refs, nomes, l.itemId as number, compra.mercadoId, l.precoUnitario as number),
  }))
}
