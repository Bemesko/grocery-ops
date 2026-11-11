// Link da nota recebido pelo Compartilhar do Android (ou colado fora de uma compra). Se uma
// compra já espera esta nota (a chave veio do QR), a nota entra nela. Senão a resposta traz
// os destinos possíveis para a pessoa escolher; a escolha usa a nota do cache.
export default defineEventHandler(async (event) => {
  const corpo = (await readBody(event)) ?? {}
  const url = urlDaNfce(corpo.url) ?? erro(400, 'Esse link não é de uma NFC-e de SC (sat.sef.sc.gov.br)')
  const sql = await useDb()

  if (ehLinkDoQr(url)) {
    const chave = lerChave(url)?.chave ?? null
    const [compra] = chave ? await sql`select id from compra where chave_nfce = ${chave}` : []
    return { resultado: 'qr' as const, url, compraId: (compra?.id as number | undefined) ?? null }
  }

  const consulta = await consultarNfce(url)
  if (consulta.resultado !== 'ok') return { resultado: consulta.resultado, mensagem: consulta.mensagem }
  const nota = consulta.nota

  const [comChave] = await sql`select id from compra where chave_nfce = ${nota.chave}`
  if (comChave) {
    const compraId = comChave.id as number
    const [lida] = await sql`select 1 from nfce_item where compra_id = ${compraId} limit 1`
    if (!lida) await sql.begin((tx) => gravarNota(tx, compraId, nota, url))
    return { resultado: 'ok' as const, compraId }
  }

  // Destinos: a compra em andamento e as finalizadas recentes sem nota, as do mercado da
  // nota (pelo CNPJ) primeiro.
  const candidatos = await sql`
    select c.id, m.nome as mercado, c.data, c.status,
      coalesce((select sum(total_centavos) from compra_item where compra_id = c.id), 0)::int8 as total,
      (m.cnpj = ${nota.cnpj}) as mesmo_mercado
    from compra c join mercado m on m.id = c.mercado_id
    where c.chave_nfce is null
      and (c.status = 'em_andamento' or (c.status = 'finalizada' and c.data >= ${somarDias(hojeSP(), -14)}))
    order by (c.status = 'em_andamento') desc, (m.cnpj = ${nota.cnpj}) desc nulls last, c.data desc, c.id desc
    limit 6
  `
  return {
    resultado: 'escolher' as const,
    nota: {
      emitente: limparNome(nota.emitente.toLowerCase()),
      emitidaEm: nota.emitidaEm,
      aPagar: nota.aPagar,
      itens: nota.itens.length,
    },
    candidatos: candidatos.map((c) => ({
      id: c.id as number,
      mercado: c.mercado as string,
      data: c.data as string,
      status: c.status as 'em_andamento' | 'finalizada',
      total: Number(c.total),
      mesmoMercado: Boolean(c.mesmoMercado),
    })),
  }
})
