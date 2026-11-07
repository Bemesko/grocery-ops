export default defineEventHandler(async () => {
  const sql = await useDb()
  return sql`
    select c.id, c.nome, c.ordem, count(i.id)::int8 as itens
    from categoria c left join item i on i.categoria_id = c.id
    group by c.id order by c.ordem, c.nome
  `
})
