// Começa uma compra. `levarTudo` (ou nada selecionado) marca a lista inteira "nesta ida".
export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const mercadoId = inteiro(corpo?.mercadoId, 'mercado', { obrigatorio: true, min: 1 })!
  const levarTudo = booleano(corpo?.levarTudo, 'levarTudo') ?? false
  const sql = await useDb()
  const [atual] = await sql`select id from compra where status = 'em_andamento'`
  if (atual) erro(409, 'Já existe uma compra em andamento', { compraId: atual.id })
  const [mercado] = await sql`select id from mercado where id = ${mercadoId}`
  if (!mercado) erro(404, 'Mercado não encontrado')
  return sql.begin(async (tx) => {
    const [selecionados] = await tx`select count(*)::int8 as n from lista_item where status = 'aberto' and nesta_ida`
    if (levarTudo || (selecionados!.n as number) === 0) {
      await tx`update lista_item set nesta_ida = true where status = 'aberto'`
    }
    const [compra] = await tx`
      insert into compra (mercado_id, data) values (${mercadoId}, ${hojeSP()}) returning id
    `
    return { id: compra!.id }
  })
})
