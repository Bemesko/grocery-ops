// Compra só pela nota (ex.: uma parada rápida num mercadinho): lê a NFC-e e cria uma compra
// finalizada na data da emissão, no mercado do CNPJ da nota. Mercado desconhecido: a
// resposta pede a escolha (um existente ou um novo com o nome do emitente) e a segunda
// chamada usa a nota do cache, sem consultar a SEFAZ de novo.
export default defineEventHandler(async (event) => {
  const corpo = (await readBody(event)) ?? {}
  const url = urlDaNfce(corpo.url) ?? erro(400, 'Esse link não é de uma NFC-e de SC (sat.sef.sc.gov.br)')
  const mercadoId = inteiro(corpo.mercadoId, 'mercado', { min: 1 })
  const mercadoNovo = texto(corpo.mercadoNovo, 'nome do mercado', { max: 60 })
  const sql = await useDb()
  const consulta = await consultarNfce(url)
  if (consulta.resultado !== 'ok') return { resultado: consulta.resultado, mensagem: consulta.mensagem }
  const nota = consulta.nota

  // Já existe uma compra com esta nota: se ela só tinha a chave (lida do QR), recebe os itens.
  const [existente] = await sql`select id from compra where chave_nfce = ${nota.chave}`
  if (existente) {
    const compraId = existente.id as number
    const [lida] = await sql`select 1 from nfce_item where compra_id = ${compraId} limit 1`
    if (!lida) await sql.begin((tx) => gravarNota(tx, compraId, nota, url))
    return { resultado: 'ok', compraId, existente: true }
  }

  let mercado: number | null = null
  if (mercadoId) {
    const [m] = await sql`select id from mercado where id = ${mercadoId}`
    mercado = (m?.id as number) ?? erro(404, 'Mercado não encontrado')
  } else {
    const [m] = await sql`select id from mercado where cnpj = ${nota.cnpj}`
    mercado = (m?.id as number) ?? null
  }
  if (!mercado && !mercadoNovo) {
    return {
      resultado: 'escolher_mercado',
      emitente: limparNome(nota.emitente.toLowerCase()),
      cnpj: nota.cnpj,
      total: nota.aPagar,
    }
  }

  const compraId = await sql.begin(async (tx) => {
    let mercadoDaCompra = mercado
    if (!mercadoDaCompra) {
      const nome = limparNome(mercadoNovo!)
      const [criado] = await tx`
        insert into mercado (nome, cnpj) values (${nome}, ${nota.cnpj})
        on conflict (nome) do nothing returning id
      `
      mercadoDaCompra = (criado?.id as number) ?? erro(409, 'Já existe um mercado com esse nome')
    }
    const emitida = nota.emitidaEm ? new Date(nota.emitidaEm) : new Date()
    const [compra] = await tx`
      insert into compra (mercado_id, status, data, iniciada_em, finalizada_em, origem)
      values (${mercadoDaCompra}, 'finalizada', ${diaDaEmissao(nota)}, ${emitida}, ${emitida}, 'nfce')
      returning id
    `
    const id = compra!.id as number
    await gravarNota(tx, id, nota, url)
    return id
  })
  log('info', 'compra criada pela nfce', { compra_id: compraId, itens: nota.itens.length })
  return { resultado: 'ok', compraId, existente: false }
})
