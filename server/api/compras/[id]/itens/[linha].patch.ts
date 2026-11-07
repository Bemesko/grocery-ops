export default defineEventHandler(async (event) => {
  const compraId = idDaRota(event)
  const linhaId = idDaRota(event, 'linha')
  const corpo = (await readBody(event)) ?? {}
  const linha = lerLinhaCarrinho(corpo)
  const sql = await useDb()
  await compraEditavel(sql, compraId)
  const [atual] = await sql`
    select unidade, quantidade, preco_unitario_centavos from compra_item
    where id = ${linhaId} and compra_id = ${compraId}
  `
  if (!atual) erro(404, 'Item não está nesta compra')
  const quantidade = linha.quantidade ?? (atual.quantidade as number)
  const preco = linha.preco ?? (atual.precoUnitarioCentavos as number)
  await sql`
    update compra_item set
      unidade = ${linha.unidade ?? (atual.unidade as string)},
      quantidade = ${quantidade},
      preco_unitario_centavos = ${preco},
      preco_cheio_centavos = ${'precoCheio' in corpo ? linha.precoCheio : sql`preco_cheio_centavos`},
      variante = ${'variante' in corpo ? linha.variante : sql`variante`},
      total_centavos = ${totalItem(quantidade, preco)}
    where id = ${linhaId}
  `
  return { ok: true }
})
