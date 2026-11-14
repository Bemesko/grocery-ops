// Tira um outro nome do item (?alias=...).
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const alias = texto(getQuery(event).alias, 'outro nome', { obrigatorio: true, max: 80 })!
  const sql = await useDb()
  await sql`delete from item_alias where item_id = ${id} and alias_normalizado = ${normalizarNome(alias)}`
  return { ok: true }
})
