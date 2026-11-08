// Renomear, mudar categoria, unidade ou embalagem habitual. Renomear para o nome de outro item → use "juntar".
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const corpo = await readBody(event)
  const nome = texto(corpo?.nome, 'nome', { max: 80 })
  const categoriaId = inteiro(corpo?.categoriaId, 'categoria', { min: 1 })
  const un = unidade(corpo?.unidade)
  const mudaEmbalagem = corpo && 'embalagem' in corpo
  const embalagem = embalagemEntrada(corpo?.embalagem)
  const sql = await useDb()
  const nomeLimpo = nome ? limparNome(nome) : null
  try {
    const [item] = await sql`
      update item set
        nome = coalesce(${nomeLimpo}, nome),
        nome_normalizado = coalesce(${nomeLimpo ? normalizarNome(nomeLimpo) : null}, nome_normalizado),
        categoria_id = coalesce(${categoriaId}, categoria_id),
        unidade = coalesce(${un}, unidade),
        embalagem_qtd = ${mudaEmbalagem ? (embalagem?.qtd ?? null) : sql`embalagem_qtd`},
        embalagem_unidade = ${mudaEmbalagem ? (embalagem?.unidade ?? null) : sql`embalagem_unidade`}
      where id = ${id}
      returning id, nome, categoria_id, unidade
    `
    if (!item) erro(404, 'Item não encontrado')
    return item
  } catch (e) {
    const codigo = (e as { code?: string }).code
    if (codigo === '23505') erro(409, 'Já existe um item com esse nome: use "juntar"')
    if (codigo === '23503') erro(400, 'Categoria não encontrada')
    throw e
  }
})
