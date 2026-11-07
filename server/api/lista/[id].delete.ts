// Tira da lista sem apagar: o histórico alimenta a sugestão por recompra (v3).
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  await sql`update lista_item set status = 'removido', resolvido_em = now() where id = ${id} and status = 'aberto'`
  return { ok: true }
})
