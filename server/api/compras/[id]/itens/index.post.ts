// Registra um item no carrinho (por id ou nome; nome novo cria o item). Se o item está
// aberto na lista, a linha fica ligada a ele (da_lista); senão é "fora da lista".
export default defineEventHandler(async (event) => {
  const compraId = idDaRota(event)
  const corpo = await readBody(event)
  const linha = lerLinhaCarrinho(corpo)
  if (linha.preco === null) erro(400, 'preço é obrigatório')
  const sql = await useDb()
  await compraEditavel(sql, compraId)
  const item = await resolverItem(sql, {
    itemId: inteiro(corpo?.itemId, 'itemId', { min: 1 }),
    nome: texto(corpo?.nome, 'nome', { max: 80 }),
    categoriaId: inteiro(corpo?.categoriaId, 'categoria', { min: 1 }),
    unidade: linha.unidade,
  })
  const un = linha.unidade ?? item.unidade
  const quantidade = linha.quantidade ?? 1
  // O app lembra a unidade usada por último (ex.: um item que passou a ser comprado a granel).
  if (un !== item.unidade) await sql`update item set unidade = ${un} where id = ${item.id}`
  const [naLista] = await sql`
    select li.id from lista_item li
    where li.item_id = ${item.id} and li.status = 'aberto'
      and not exists (select 1 from compra_item ci where ci.compra_id = ${compraId} and ci.lista_item_id = li.id)
  `
  const [criado] = await sql`
    insert into compra_item (compra_id, item_id, lista_item_id, variante, unidade, quantidade,
      preco_unitario_centavos, preco_cheio_centavos, da_lista, total_centavos)
    values (${compraId}, ${item.id}, ${(naLista?.id as number) ?? null}, ${linha.variante}, ${un}, ${quantidade},
      ${linha.preco}, ${linha.precoCheio}, ${Boolean(naLista)}, ${totalItem(quantidade, linha.preco!)})
    returning id
  `
  metricas.itensCarrinho.add(1, { 'grocery.from_list': Boolean(naLista) })
  return { id: criado!.id, itemId: item.id }
})
