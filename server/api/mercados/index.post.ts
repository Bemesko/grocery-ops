export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const nome = limparNome(texto(corpo?.nome, 'nome', { obrigatorio: true, max: 60 })!)
  const sql = await useDb()
  const [criado] = await sql`
    insert into mercado (nome) values (${nome})
    on conflict (nome) do nothing
    returning id, nome
  `
  if (!criado) erro(409, 'Já existe um mercado com esse nome')
  return criado
})
