export default defineEventHandler(async (event) => {
  const sql = await useDb()
  return resumoCompra(sql, idDaRota(event))
})
