export default defineEventHandler(async () => {
  const sql = await useDb()
  return sql`
    select i.id, i.arquivo, i.criada_em, count(distinct c.id)::int8 as compras,
      coalesce(sum(ci.total_centavos), 0)::int8 as total
    from importacao i
      left join compra c on c.importacao_id = i.id
      left join compra_item ci on ci.compra_id = c.id
    group by i.id order by i.criada_em desc
  `
})
