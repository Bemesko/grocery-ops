// "Comprado" sem registrar preço (ex.: comprado na padaria): sai da lista como comprado.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  await sql`
    update lista_item set status = 'comprado', nesta_ida = false, resolvido_em = now()
    where id = ${id} and status = 'aberto'
  `
  return { ok: true }
})
