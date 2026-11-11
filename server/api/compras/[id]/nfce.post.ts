import type { RespostaLeituraNota } from '../../../../shared/types/api'

// Lê a NFC-e e guarda as linhas na compra. O link do QR sempre pede a verificação da SEFAZ:
// ele não é consultado, só guarda a chave e o link para a pessoa abrir no navegador. O link
// da página da nota (depois da verificação) é consultado uma vez por chamada: a SEFAZ
// limita por IP. Se a nota não pode ser lida, o link fica guardado para tentar depois.
export default defineEventHandler(async (event): Promise<RespostaLeituraNota> => {
  const id = idDaRota(event)
  const corpo = (await readBody(event)) ?? {}
  const url = urlDaNfce(corpo.url) ?? erro(400, 'Esse link não é de uma NFC-e de SC (sat.sef.sc.gov.br)')
  const sql = await useDb()
  await compraEditavel(sql, id)
  const consulta = await consultarNfce(url)
  if (consulta.resultado === 'ok') {
    const nota = consulta.nota
    const esperada = await chaveEsperada(sql, id)
    if (esperada && esperada !== nota.chave) {
      erro(409, `Este link é de outra nota (nº ${nota.numero ?? '?'} de ${limparNome(nota.emitente.toLowerCase())})`)
    }
    await sql.begin((tx) => gravarNota(tx, id, nota, url))
    return { resultado: 'ok', mensagem: null, conferencia: await conferencia(sql, id) }
  }
  await guardarPendente(sql, id, url)
  return { resultado: consulta.resultado, mensagem: consulta.mensagem, conferencia: await conferencia(sql, id) }
})
