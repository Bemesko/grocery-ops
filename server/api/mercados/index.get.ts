export default defineEventHandler(async () => {
  const sql = await useDb()
  return sql`select id, nome from mercado order by nome`
})
