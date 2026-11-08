// Apaga um item sem uso (nunca comprado e fora da lista, inclusive do histórico dela).
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  const [uso] = await sql`
    select
      (select count(*) from compra_item where item_id = ${id})::int8
        + (select count(*) from lista_item where item_id = ${id})::int8 as usos
  `
  if ((uso!.usos as number) > 0) erro(409, 'O item tem compras ou já esteve na lista: junte com outro em vez de apagar')
  const apagados = await sql`delete from item where id = ${id} returning id`
  if (!apagados.length) erro(404, 'Item não encontrado')
  return { ok: true }
})
