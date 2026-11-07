export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const corpo = await readBody(event)
  const nome = texto(corpo?.nome, 'nome', { max: 60 })
  const sql = await useDb()
  try {
    const [atualizada] = await sql`
      update categoria set nome = coalesce(${nome ? limparNome(nome) : null}, nome)
      where id = ${id} returning id, nome, ordem
    `
    if (!atualizada) erro(404, 'Categoria não encontrada')
    return atualizada
  } catch (e) {
    if ((e as { code?: string }).code === '23505') erro(409, 'Já existe uma categoria com esse nome')
    throw e
  }
})
