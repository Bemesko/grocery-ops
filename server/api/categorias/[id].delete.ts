export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  const [uso] = await sql`select count(*)::int8 as n from item where categoria_id = ${id}`
  if ((uso!.n as number) > 0) erro(409, 'A categoria tem itens: mova-os para outra antes de apagar')
  await sql`delete from categoria where id = ${id}`
  return { ok: true }
})
