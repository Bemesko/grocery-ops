import type { Sql } from './db'

/**
 * Põe um item na lista. Item já aberto não duplica (a quantidade nova, se vier, substitui).
 * Durante uma compra em andamento, o que entra já vai para "nesta ida".
 */
export async function adicionarNaLista(
  sql: Sql,
  itemId: number,
  { quantidade = null, prioritario = false, origem = 'app' }: { quantidade?: string | null; prioritario?: boolean; origem?: 'app' | 'alexa' } = {},
): Promise<{ id: number; jaExistia: boolean }> {
  const [emAndamento] = await sql`select id from compra where status = 'em_andamento'`
  const [criado] = await sql`
    insert into lista_item (item_id, quantidade, prioritario, nesta_ida, origem)
    values (${itemId}, ${quantidade}, ${prioritario}, ${Boolean(emAndamento)}, ${origem})
    on conflict (item_id) where status = 'aberto' do nothing
    returning id
  `
  if (criado) return { id: criado.id as number, jaExistia: false }
  const [existente] = await sql`
    update lista_item set quantidade = coalesce(${quantidade}, quantidade)
    where item_id = ${itemId} and status = 'aberto' returning id
  `
  return { id: existente!.id as number, jaExistia: true }
}
