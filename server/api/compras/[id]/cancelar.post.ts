// Desiste da compra em andamento. A lista não muda.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  const compra = await buscarCompra(sql, id)
  if (compra.status !== 'em_andamento') erro(409, 'A compra não está em andamento')
  await sql`update compra set status = 'cancelada', finalizada_em = now() where id = ${id}`
  return { ok: true }
})
