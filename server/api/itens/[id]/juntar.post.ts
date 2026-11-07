// Junta o item da rota em `destinoId`: compras e lista passam para o destino e o item some.
export default defineEventHandler(async (event) => {
  const origem = idDaRota(event)
  const corpo = await readBody(event)
  const destino = inteiro(corpo?.destinoId, 'destinoId', { obrigatorio: true, min: 1 })!
  if (destino === origem) erro(400, 'Escolha outro item')
  const sql = await useDb()
  await sql.begin(async (tx) => {
    const encontrados = await tx`select id from item where id in ${tx([origem, destino])}`
    if (encontrados.length !== 2) erro(404, 'Item não encontrado')
    await tx`update compra_item set item_id = ${destino} where item_id = ${origem}`
    // Se os dois estão abertos na lista, fica só o do destino (prioridade e seleção somadas).
    const [abertoOrigem] = await tx`select id, prioritario, nesta_ida from lista_item where item_id = ${origem} and status = 'aberto'`
    const [abertoDestino] = await tx`select id from lista_item where item_id = ${destino} and status = 'aberto'`
    if (abertoOrigem && abertoDestino) {
      await tx`
        update lista_item set
          prioritario = prioritario or ${abertoOrigem.prioritario as boolean},
          nesta_ida = nesta_ida or ${abertoOrigem.nestaIda as boolean}
        where id = ${abertoDestino.id as number}
      `
      await tx`update lista_item set status = 'removido', resolvido_em = now() where id = ${abertoOrigem.id as number}`
    }
    await tx`update lista_item set item_id = ${destino} where item_id = ${origem}`
    await tx`delete from item where id = ${origem}`
  })
  return { ok: true, id: destino }
})
