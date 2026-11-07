// Corpo: { arquivo, conteudo, confirmar }. Sem `confirmar`, só devolve a prévia.
// Com erros em qualquer linha, nada é gravado.
export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const conteudo = typeof corpo?.conteudo === 'string' ? corpo.conteudo : erro(400, 'Envie o conteúdo do CSV')
  if (conteudo.length > 2_000_000) erro(413, 'Arquivo grande demais (máx. 2 MB)')
  const arquivo = texto(corpo?.arquivo, 'arquivo', { max: 200 }) ?? 'importacao.csv'
  const sql = await useDb()
  const previa = await analisarCsv(sql, conteudo)
  const { linhas, ...resto } = previa
  if (!corpo?.confirmar) return { ...resto, totalLinhas: linhas.length }
  if (previa.erros.length) erro(422, 'Corrija os erros antes de importar', { erros: previa.erros })
  if (!linhas.length) erro(422, 'Nenhuma linha para importar')
  const id = await gravarImportacao(sql, arquivo, previa)
  return { id, compras: previa.compras.length, itens: linhas.length }
})
