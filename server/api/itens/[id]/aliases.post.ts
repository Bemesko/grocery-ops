// Outro nome para o item (ex.: "mandioca" para "Aipim"): a busca e a lista da Alexa passam a
// achar o item por ele.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const corpo = await readBody(event)
  const alias = limparNome(texto(corpo?.alias, 'outro nome', { obrigatorio: true, max: 80 })!)
  const chave = normalizarNome(alias)
  const sql = await useDb()
  const [item] = await sql`select id from item where id = ${id}`
  if (!item) erro(404, 'Item não encontrado')
  const [outroItem] = await sql`select nome from item where nome_normalizado = ${chave}`
  if (outroItem) erro(409, `Já existe o item “${outroItem.nome}” com esse nome: use "juntar"`)
  const [usado] = await sql`
    select i.nome from item_alias a join item i on i.id = a.item_id where a.alias_normalizado = ${chave}
  `
  if (usado) erro(409, `“${alias}” já é outro nome de “${usado.nome}”`)
  await sql`insert into item_alias (alias_normalizado, alias, item_id) values (${chave}, ${alias}, ${id})`
  return { alias }
})
