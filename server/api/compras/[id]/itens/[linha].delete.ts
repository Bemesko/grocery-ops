export default defineEventHandler(async (event) => {
  const compraId = idDaRota(event)
  const linhaId = idDaRota(event, 'linha')
  const sql = await useDb()
  await compraEditavel(sql, compraId)
  await sql`delete from compra_item where id = ${linhaId} and compra_id = ${compraId}`
  return { ok: true }
})
