// Desfaz uma importação inteira: as compras dela somem (cascade); os itens criados ficam.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  await sql`delete from importacao where id = ${id}`
  return { ok: true }
})
