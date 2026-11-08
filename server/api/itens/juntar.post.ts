import type { Sql } from '../../utils/db'

// Junta vários itens (`origemIds`) em `destinoId` de uma vez (gestão de itens).
export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const destino = inteiro(corpo?.destinoId, 'destinoId', { obrigatorio: true, min: 1 })!
  const origens = listaDeIds(corpo?.origemIds, 'origemIds').filter((id) => id !== destino)
  if (!origens.length) erro(400, 'Escolha os itens a juntar')
  const sql = await useDb()
  await sql.begin(async (tx) => {
    for (const origem of origens) await juntarItem(tx as unknown as Sql, origem, destino)
  })
  return { ok: true, id: destino, juntados: origens.length }
})
