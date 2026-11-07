// Fecha a compra: itens pegos saem da lista, a seleção "nesta ida" é limpa.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const corpo = (await readBody(event)) ?? {}
  const totalNota = inteiro(corpo.totalNota, 'total da nota', { min: 1 })
  const sql = await useDb()
  const compra = await buscarCompra(sql, id)
  if (compra.status !== 'em_andamento') erro(409, 'A compra não está em andamento')
  await sql.begin(async (tx) => {
    await tx`
      update compra set status = 'finalizada', finalizada_em = now(), data = ${hojeSP()},
        total_nota_centavos = ${totalNota}
      where id = ${id}
    `
    await tx`
      update lista_item set status = 'comprado', resolvido_em = now(), nesta_ida = false
      where status = 'aberto'
        and id in (select lista_item_id from compra_item where compra_id = ${id} and lista_item_id is not null)
    `
    await tx`update lista_item set nesta_ida = false where status = 'aberto'`
  })
  const resumo = await resumoCompra(sql, id)
  const atributos = { 'grocery.market': resumo.compra.mercado }
  metricas.comprasFinalizadas.add(1, atributos)
  metricas.valorCompra.record(resumo.compra.total / 100, atributos)
  log('info', 'compra finalizada', { compra_id: id, total_centavos: resumo.compra.total, itens: resumo.itens.length })
  return resumo
})
