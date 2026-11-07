// "Ajustar saldo": o saldo somado dos VRs agora. Compras finalizadas antes deste momento
// deixam de mexer no saldo.
export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const saldo = inteiro(corpo?.saldo, 'saldo', { obrigatorio: true, min: 0 })!
  const sql = await useDb()
  await sql`insert into saldo_ajuste (saldo_centavos) values (${saldo})`
  return { budget: await baseBudget(sql) }
})
