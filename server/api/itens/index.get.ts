import type { ItemResumo } from '../../../shared/types/api'

// Todos os itens, para as sugestões ao digitar e o preço pré-preenchido no mercado.
export default defineEventHandler(async (): Promise<ItemResumo[]> => {
  const sql = await useDb()
  const itens = await sql`
    select i.id, i.nome, i.categoria_id, i.unidade, i.embalagem_qtd, i.embalagem_unidade,
      (select count(*) from compra_item ci where ci.item_id = i.id) as compras,
      (select count(*) from compra_item ci where ci.item_id = i.id)
        + (select count(*) from lista_item li where li.item_id = i.id) as usos,
      coalesce((select array_agg(a.alias order by a.alias) from item_alias a where a.item_id = i.id), '{}') as aliases
    from item i order by i.nome
  `
  const refs = await referencias(sql)
  const quantidades = await ultimasQuantidades(sql)
  const precos = new Map<number, ItemResumo['precos']>()
  for (const r of refs.values()) {
    const mapa = precos.get(r.itemId) ?? {}
    mapa[r.mercadoId] = { preco: r.preco, quantidade: r.quantidade, variante: r.variante, data: r.data, embalagem: r.embalagem }
    precos.set(r.itemId, mapa)
  }
  return itens.map((i) => ({
    id: i.id as number,
    nome: i.nome as string,
    categoriaId: i.categoriaId as number,
    unidade: i.unidade as ItemResumo['unidade'],
    usos: Number(i.usos),
    compras: Number(i.compras),
    aliases: i.aliases as string[],
    embalagem: embalagemDe(i.embalagemQtd, i.embalagemUnidade),
    ultimaQuantidade: quantidades.get(i.id as number) ?? null,
    precos: precos.get(i.id as number) ?? {},
  }))
})
