import type { RespostaLeituraNota } from '../../../../shared/types/api'

// Lê a NFC-e pelo link do QR e guarda as linhas na compra. Uma consulta por chamada: a
// SEFAZ limita por IP. Se a nota não pode ser lida, o link fica guardado para tentar depois.
export default defineEventHandler(async (event): Promise<RespostaLeituraNota> => {
  const id = idDaRota(event)
  const corpo = (await readBody(event)) ?? {}
  const url = urlDaNfce(corpo.url) ?? erro(400, 'Esse QR não é de uma NFC-e de SC (sat.sef.sc.gov.br)')
  const sql = await useDb()
  await compraEditavel(sql, id)
  const consulta = await consultarNfce(url)
  if (consulta.resultado === 'ok') {
    const nota = consulta.nota
    await sql.begin((tx) => gravarNota(tx, id, nota, url))
    return { resultado: 'ok', mensagem: null, conferencia: await conferencia(sql, id) }
  }
  await guardarPendente(sql, id, url)
  return { resultado: consulta.resultado, mensagem: consulta.mensagem, conferencia: await conferencia(sql, id) }
})
