// Compra registrada à mão (#65): só mercado, data e total, sem itens. Entra finalizada, com o
// total informado como o total oficial (como o da nota, #48), e conta no orçamento da semana
// pela data e no saldo do VR. Uma compra de dia passado fica com a hora do meio-dia daquele
// dia (como a importação): se um ajuste de saldo for mais novo, ele já a descontou.
export default defineEventHandler(async (event) => {
  const corpo = (await readBody(event)) ?? {}
  const mercadoId = inteiro(corpo.mercadoId, 'mercadoId', { obrigatorio: true, min: 1 })!
  const total = inteiro(corpo.total, 'total', { obrigatorio: true, min: 1 })!
  const data = validarDia(corpo.data) ?? erro(400, 'data inválida')
  const hoje = hojeSP()
  if (data > hoje) erro(400, 'a data da compra não pode ser no futuro')
  const sql = await useDb()
  const [mercado] = await sql`select nome from mercado where id = ${mercadoId}`
  if (!mercado) erro(404, 'mercado não encontrado')
  const [compra] = await sql`
    insert into compra (mercado_id, status, data, iniciada_em, finalizada_em, total_nota_centavos, origem)
    values (${mercadoId}, 'finalizada', ${data}, ${data === hoje ? new Date() : meioDiaSP(data)},
      ${data === hoje ? new Date() : meioDiaSP(data)}, ${total}, 'manual')
    returning id
  `
  const atributos = { 'grocery.market': mercado.nome as string }
  metricas.comprasFinalizadas.add(1, atributos)
  metricas.valorCompra.record(total / 100, atributos)
  log('info', 'compra manual registrada', { compra_id: compra!.id, total_centavos: total })
  return { compraId: compra!.id as number }
})
