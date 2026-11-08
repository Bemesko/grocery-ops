import type { Sql } from '../../../utils/db'

// Junta o item da rota em `destinoId`: compras e lista passam para o destino e o item some.
export default defineEventHandler(async (event) => {
  const origem = idDaRota(event)
  const corpo = await readBody(event)
  const destino = inteiro(corpo?.destinoId, 'destinoId', { obrigatorio: true, min: 1 })!
  const sql = await useDb()
  await sql.begin((tx) => juntarItem(tx as unknown as Sql, origem, destino))
  return { ok: true, id: destino }
})
