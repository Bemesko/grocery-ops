export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  const [uso] = await sql`select count(*)::int8 as n from compra where mercado_id = ${id}`
  if ((uso!.n as number) > 0) erro(409, 'O mercado tem compras registradas e não pode ser apagado')
  await sql`delete from mercado where id = ${id}`
  return { ok: true }
})
