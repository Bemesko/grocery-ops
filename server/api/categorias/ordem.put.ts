// Corpo: lista de ids na ordem dos corredores.
export default defineEventHandler(async (event) => {
  const ids = await readBody(event)
  if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id))) erro(400, 'Envie a lista de ids')
  const sql = await useDb()
  await sql.begin(async (tx) => {
    for (const [i, id] of (ids as number[]).entries()) {
      await tx`update categoria set ordem = ${i + 1} where id = ${id}`
    }
  })
  return { ok: true }
})
