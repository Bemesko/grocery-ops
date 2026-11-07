export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const corpo = await readBody(event)
  const prioritario = booleano(corpo?.prioritario, 'prioritario')
  const nestaIda = booleano(corpo?.nestaIda, 'nestaIda')
  const mudaQuantidade = corpo && 'quantidade' in corpo
  const quantidade = texto(corpo?.quantidade, 'quantidade', { max: 40 })
  const sql = await useDb()
  const [atualizado] = await sql`
    update lista_item set
      prioritario = coalesce(${prioritario}, prioritario),
      nesta_ida = coalesce(${nestaIda}, nesta_ida),
      quantidade = ${mudaQuantidade ? sql`${quantidade}` : sql`quantidade`}
    where id = ${id} and status = 'aberto'
    returning id, prioritario, nesta_ida, quantidade
  `
  if (!atualizado) erro(404, 'Item não está na lista')
  return atualizado
})
