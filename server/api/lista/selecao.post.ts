// Seleção "nesta ida" em lote: prioritarios | todos | nenhum.
export default defineEventHandler(async (event) => {
  const { modo } = (await readBody(event)) ?? {}
  const sql = await useDb()
  if (modo === 'prioritarios') {
    await sql`update lista_item set nesta_ida = prioritario where status = 'aberto'`
  } else if (modo === 'todos' || modo === 'nenhum') {
    await sql`update lista_item set nesta_ida = ${modo === 'todos'} where status = 'aberto'`
  } else {
    erro(400, 'modo deve ser prioritarios, todos ou nenhum')
  }
  return { ok: true }
})
