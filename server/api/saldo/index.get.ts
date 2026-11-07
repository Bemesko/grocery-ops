export default defineEventHandler(async () => {
  const sql = await useDb()
  const ajustes = await sql`select id, em, saldo_centavos as saldo from saldo_ajuste order by em desc, id desc limit 20`
  return { budget: await baseBudget(sql), ajustes }
})
