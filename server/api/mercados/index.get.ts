export default defineEventHandler(async () => {
  const sql = await useDb()
  return sql`select id, nome, tipo from mercado order by nome`
})
