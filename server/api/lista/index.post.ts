// Adiciona à lista por id ou nome (cria o item se o nome é novo). Item já aberto na lista
// não duplica: a resposta traz `jaExistia`.
export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const sql = await useDb()
  const item = await resolverItem(sql, {
    itemId: inteiro(corpo?.itemId, 'itemId', { min: 1 }),
    nome: texto(corpo?.nome, 'nome', { max: 80 }),
    categoriaId: inteiro(corpo?.categoriaId, 'categoria', { min: 1 }),
    unidade: unidade(corpo?.unidade),
  })
  const linha = await adicionarNaLista(sql, item.id, {
    quantidade: texto(corpo?.quantidade, 'quantidade', { max: 40 }),
    prioritario: booleano(corpo?.prioritario, 'prioritario') ?? false,
  })
  return { id: linha.id, itemId: item.id, nome: item.nome, jaExistia: linha.jaExistia }
})
