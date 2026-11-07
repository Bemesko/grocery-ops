// Adiciona à lista por id ou nome (cria o item se o nome é novo). Item já aberto na lista
// não duplica: a resposta traz `jaExistia`.
export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const sql = await useDb()
  const item = await resolverItem(sql, {
    itemId: inteiro(corpo?.itemId, 'itemId', { min: 1 }),
    nome: texto(corpo?.nome, 'nome', { max: 80 }),
    categoriaId: inteiro(corpo?.categoriaId, 'categoria', { min: 1 }),
    unidade: unidade(corpo?.unidade),
  })
  const quantidade = texto(corpo?.quantidade, 'quantidade', { max: 40 })
  const prioritario = booleano(corpo?.prioritario, 'prioritario') ?? false
  // Durante uma compra, o que entra na lista já vai para "nesta ida".
  const [emAndamento] = await sql`select id from compra where status = 'em_andamento'`
  const [criado] = await sql`
    insert into lista_item (item_id, quantidade, prioritario, nesta_ida)
    values (${item.id}, ${quantidade}, ${prioritario}, ${Boolean(emAndamento)})
    on conflict (item_id) where status = 'aberto' do nothing
    returning id
  `
  if (criado) return { id: criado.id, itemId: item.id, nome: item.nome, jaExistia: false }
  const [existente] = await sql`
    update lista_item set quantidade = coalesce(${quantidade}, quantidade)
    where item_id = ${item.id} and status = 'aberto' returning id
  `
  return { id: existente!.id, itemId: item.id, nome: item.nome, jaExistia: true }
})
