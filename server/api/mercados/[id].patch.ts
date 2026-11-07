export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const corpo = await readBody(event)
  const nome = texto(corpo?.nome, 'nome', { max: 60 })
  const tipo = corpo?.tipo === undefined ? null : corpo.tipo === 'atacado' ? 'atacado' : 'varejo'
  const sql = await useDb()
  try {
    const [atualizado] = await sql`
      update mercado set
        nome = coalesce(${nome ? limparNome(nome) : null}, nome),
        tipo = coalesce(${tipo}, tipo)
      where id = ${id} returning id, nome, tipo
    `
    if (!atualizado) erro(404, 'Mercado não encontrado')
    return atualizado
  } catch (e) {
    if ((e as { code?: string }).code === '23505') erro(409, 'Já existe um mercado com esse nome')
    throw e
  }
})
