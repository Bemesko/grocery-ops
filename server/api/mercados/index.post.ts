export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const nome = limparNome(texto(corpo?.nome, 'nome', { obrigatorio: true, max: 60 })!)
  const tipo = corpo?.tipo === 'atacado' ? 'atacado' : 'varejo'
  const sql = await useDb()
  const [criado] = await sql`
    insert into mercado (nome, tipo) values (${nome}, ${tipo})
    on conflict (nome) do nothing
    returning id, nome, tipo
  `
  if (!criado) erro(409, 'Já existe um mercado com esse nome')
  return criado
})
