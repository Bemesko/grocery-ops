// Muda a categoria de vários itens de uma vez (gestão de itens).
export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const ids = listaDeIds(corpo?.ids, 'ids')
  const categoriaId = inteiro(corpo?.categoriaId, 'categoria', { obrigatorio: true, min: 1 })!
  const sql = await useDb()
  const [categoria] = await sql`select id from categoria where id = ${categoriaId}`
  if (!categoria) erro(400, 'Categoria não encontrada')
  const alterados = await sql`update item set categoria_id = ${categoriaId} where id in ${sql(ids)} returning id`
  return { ok: true, alterados: alterados.length }
})
