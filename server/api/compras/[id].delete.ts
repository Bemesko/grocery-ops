// Exclui uma compra finalizada ou cancelada, com os itens e a nota dela. A lista não muda
// (os itens foram comprados de verdade), nem os itens e códigos de produto criados com ela.
// O saldo e os Gastos se recalculam sozinhos. A compra em andamento se cancela.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  const compra = await buscarCompra(sql, id)
  if (compra.status === 'em_andamento') erro(409, 'Cancele a compra em andamento em vez de excluir')
  await sql`delete from compra where id = ${id}`
  log('info', 'compra excluida', { compra_id: id, status: compra.status, origem: compra.origem })
  return { ok: true }
})
