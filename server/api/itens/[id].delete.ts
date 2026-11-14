// Apaga um item que não está em nenhuma compra. O histórico da lista (aberto ou não) sai
// junto. Com compras, recusa: para apagar, é preciso apagar as compras antes.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  const [uso] = await sql`select count(distinct compra_id)::int8 as compras from compra_item where item_id = ${id}`
  const compras = Number(uso!.compras)
  if (compras > 0) {
    erro(409, `O item aparece em ${compras} ${compras === 1 ? 'compra' : 'compras'}: apague ${compras === 1 ? 'a compra' : 'as compras'} antes`)
  }
  const apagados = await sql`delete from item where id = ${id} returning id`
  if (!apagados.length) erro(404, 'Item não encontrado')
  return { ok: true }
})
