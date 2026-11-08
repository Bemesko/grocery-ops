import type { CompraItem, PrecoReferencia, Variacao } from '../../shared/types/api'
import type { Embalagem } from '../../shared/utils/embalagem'
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
      ci.embalagem_qtd, ci.embalagem_unidade, c.data, c.finalizada_em
    from compra_item ci join compra c on c.id = ci.compra_id
    where c.status = 'finalizada' ${antesDe ? sql`and c.finalizada_em < ${antesDe}` : sql``}
    order by ci.item_id, c.mercado_id, c.finalizada_em desc, ci.id desc
  `
  const mapa = new Map<string, Referencia>()
  for (const { embalagemQtd, embalagemUnidade, ...l } of linhas) {
    mapa.set(`${l.itemId}:${l.mercadoId}`, { ...l, embalagem: embalagemDe(embalagemQtd, embalagemUnidade) } as Referencia)
  }
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

/**
 * ↑↓ do preço em relação à compra anterior do item (no mesmo mercado; sem histórico nele,
 * no outro). Com embalagens de tamanhos diferentes, compara o preço por kg/L/un e aponta
 * reduflação.
 */
export function variacao(
  refs: Map<string, Referencia>,
  nomesMercados: Map<number, string>,
  itemId: number,
  mercadoId: number,
  preco: number,
  embalagem: Embalagem | null = null,
  variante: string | null = null,
): Variacao | null {
  const mesmo = refs.get(`${itemId}:${mercadoId}`)
  const ref = mesmo ?? referenciaOutroMercado(refs, itemId, mercadoId)
  if (!ref || ref.preco === 0) return null
  let anterior = ref.preco
  let atual = preco
  let porConteudo: string | null = null
  if (embalagem && ref.embalagem && mesmaBase(embalagem, ref.embalagem) && !mesmoConteudo(embalagem, ref.embalagem)) {
    anterior = precoBase(ref.preco, ref.embalagem)
    atual = precoBase(preco, embalagem)
    porConteudo = rotuloBase(baseDe(embalagem.unidade))
  }
  // Marcas diferentes não são o mesmo produto: aí não dá para falar em reduflação.
  const mesmaVariante = !variante || !ref.variante || normalizarNome(variante) === normalizarNome(ref.variante)
  return {
    anterior,
    percentual: (atual - anterior) / anterior,
    outroMercado: mesmo ? null : (nomesMercados.get(ref.mercadoId) ?? null),
    porConteudo,
    reduflacao: mesmaVariante ? detectarReduflacao(ref, { preco, embalagem }) : null,
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
      ci.variante, ci.embalagem_qtd, ci.embalagem_unidade, ci.da_lista, ci.total_centavos as total
    from compra_item ci join item i on i.id = ci.item_id
    where ci.compra_id = ${compra.id}
    order by ci.id
  `
  const refs = await referencias(sql, compra.finalizadaEm ?? undefined)
  const nomes = await nomesDosMercados(sql)
  return linhas.map(({ embalagemQtd, embalagemUnidade, ...l }) => {
    const embalagem = embalagemDe(embalagemQtd, embalagemUnidade)
    return {
      ...(l as unknown as CompraItem),
      embalagem,
      variacao: variacao(refs, nomes, l.itemId as number, compra.mercadoId, l.precoUnitario as number, embalagem, l.variante as string | null),
    }
  })
}

/** Embalagem habitual de cada item (só os que têm). */
export async function embalagensHabituais(sql: Sql): Promise<Map<number, Embalagem>> {
  const linhas = await sql`select id, embalagem_qtd, embalagem_unidade from item where embalagem_qtd is not null`
  return new Map(linhas.map((l) => [l.id as number, embalagemDe(l.embalagemQtd, l.embalagemUnidade)!]))
}
