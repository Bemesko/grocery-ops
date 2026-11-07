// Corrige uma compra (também as já finalizadas): total da nota, mercado e data.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const corpo = (await readBody(event)) ?? {}
  const sql = await useDb()
  await buscarCompra(sql, id)
  if ('totalNota' in corpo) {
    const total = inteiro(corpo.totalNota, 'total da nota', { min: 1 })
    await sql`update compra set total_nota_centavos = ${total} where id = ${id}`
  }
  if (corpo.mercadoId !== undefined) {
    const mercadoId = inteiro(corpo.mercadoId, 'mercado', { obrigatorio: true, min: 1 })!
    const [m] = await sql`select id from mercado where id = ${mercadoId}`
    if (!m) erro(404, 'Mercado não encontrado')
    await sql`update compra set mercado_id = ${mercadoId} where id = ${id}`
  }
  if (corpo.data !== undefined) {
    const data = validarDia(corpo.data) ?? erro(400, 'data inválida')
    await sql`update compra set data = ${data} where id = ${id}`
  }
  return resumoCompra(sql, id)
})
