// Histórico de compras finalizadas, mais recentes primeiro.
export default defineEventHandler(async (event) => {
  const limite = Math.min(200, Number(getQuery(event).limite) || 50)
  const sql = await useDb()
  return sql`
    select c.id, c.mercado_id, m.nome as mercado, c.status, c.data, c.origem,
      c.total_nota_centavos as total_nota,
      coalesce(sum(ci.total_centavos), 0)::int8 as total,
      count(ci.id)::int8 as itens
    from compra c join mercado m on m.id = c.mercado_id left join compra_item ci on ci.compra_id = c.id
    where c.status = 'finalizada'
    group by c.id, m.nome
    order by c.data desc, c.finalizada_em desc
    limit ${limite}
  `
})
