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
  const un = linha.unidade ?? (atual.unidade as string)
  const quantidade = linha.quantidade ?? (atual.quantidade as number)
  const mudaEmbalagem = 'embalagem' in corpo || un === 'kg'
  const embalagem = un === 'un' ? linha.embalagem : null
  const preco = linha.preco ?? (atual.precoUnitarioCentavos as number)
  await sql`
    update compra_item set
      unidade = ${un},
      quantidade = ${quantidade},
      preco_unitario_centavos = ${preco},
      preco_cheio_centavos = ${'precoCheio' in corpo ? linha.precoCheio : sql`preco_cheio_centavos`},
      variante = ${'variante' in corpo ? linha.variante : sql`variante`},
      embalagem_qtd = ${mudaEmbalagem ? (embalagem?.qtd ?? null) : sql`embalagem_qtd`},
      embalagem_unidade = ${mudaEmbalagem ? (embalagem?.unidade ?? null) : sql`embalagem_unidade`},
      total_centavos = ${totalItem(quantidade, preco)}
    where id = ${linhaId}
  `
  return { ok: true }
})
