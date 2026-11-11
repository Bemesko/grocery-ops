// Nota fiscal da compra e o casamento das linhas com os itens anotados (sem consultar a SEFAZ).
export default defineEventHandler(async (event) => {
  const sql = await useDb()
  return conferencia(sql, idDaRota(event))
})
