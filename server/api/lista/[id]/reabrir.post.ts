// Desfaz "tirar da lista" ou "comprado" (o toast de desfazer da lista).
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  try {
    await sql`
      update lista_item set status = 'aberto', resolvido_em = null
      where id = ${id} and status in ('removido', 'comprado')
    `
  } catch (e) {
    if ((e as { code?: string }).code === '23505') erro(409, 'O item já foi anotado de novo')
    throw e
  }
  return { ok: true }
})
