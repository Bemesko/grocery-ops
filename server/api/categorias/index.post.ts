export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const nome = limparNome(texto(corpo?.nome, 'nome', { obrigatorio: true, max: 60 })!)
  const sql = await useDb()
  const [criada] = await sql`
    insert into categoria (nome, ordem)
    values (${nome}, (select coalesce(max(ordem), 0) + 1 from categoria))
    on conflict (nome) do nothing
    returning id, nome, ordem
  `
  if (!criada) erro(409, 'Já existe uma categoria com esse nome')
  return criada
})
