// Detalhe do item: último preço em cada mercado e as últimas compras.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  const [item] = await sql`
    select i.id, i.nome, i.categoria_id, i.unidade, c.nome as categoria
    from item i join categoria c on c.id = i.categoria_id where i.id = ${id}
  `
  if (!item) erro(404, 'Item não encontrado')
  const compras = await sql`
    select c.id as compra_id, c.data, m.id as mercado_id, m.nome as mercado, ci.unidade, ci.quantidade,
      ci.preco_unitario_centavos as preco_unitario, ci.preco_cheio_centavos as preco_cheio,
      ci.variante, ci.total_centavos as total
    from compra_item ci join compra c on c.id = ci.compra_id join mercado m on m.id = c.mercado_id
    where ci.item_id = ${id} and c.status = 'finalizada'
    order by c.finalizada_em desc, ci.id desc
    limit 30
  `
  const porMercado = new Map<number, (typeof compras)[number]>()
  for (const c of compras) if (!porMercado.has(c.mercadoId as number)) porMercado.set(c.mercadoId as number, c)
  return { item, ultimoPorMercado: [...porMercado.values()], compras }
})
