// NFC-e (docs/produto-v1.md, "Nota fiscal (NFC-e)"): consulta a página pública da SEFAZ-SC
// pelo link do QR, guarda as linhas da nota na compra e monta a conferência com o que foi
// anotado. A SEFAZ limita consultas por IP: uma consulta por leitura, sem nova tentativa
// automática, e o resultado fica em cache por alguns minutos.
import type { ConferenciaNota, DecisaoLinha, LinhaConferencia, ResultadoLeitura } from '../../shared/types/api'
import type { ItemAnotado } from '../../shared/utils/casamento'
import type { NotaLida } from '../../shared/utils/notaFiscal'
import type { Sql } from './db'

const HOST = 'sat.sef.sc.gov.br'
const TEMPO_LIMITE = 10_000
const TAMANHO_MAXIMO = 2_000_000
const VALIDADE_CACHE = 10 * 60_000

export type Consulta =
  | { resultado: 'ok'; nota: NotaLida }
  | { resultado: Exclude<ResultadoLeitura, 'ok'>; mensagem: string }

const MENSAGENS = {
  verificacao: 'A SEFAZ pediu uma verificação de segurança para esta nota. Abra a nota no navegador para ver os itens.',
  limite: 'A SEFAZ limitou as consultas por alguns minutos. Tente de novo mais tarde.',
  desconhecida: 'A página da nota não veio no formato esperado.',
} as const

/** Link do QR → URL da SEFAZ-SC (só esse host), ou null. */
export function urlDaNfce(texto: unknown): string | null {
  if (typeof texto !== 'string' || texto.length > 2000) return null
  try {
    const url = new URL(texto.trim())
    if (url.hostname.toLowerCase() !== HOST || !['http:', 'https:'].includes(url.protocol)) return null
    url.protocol = 'https:'
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

const cache = new Map<string, { em: number; consulta: Consulta }>()

function guardarNoCache(url: string, consulta: Consulta) {
  const agora = Date.now()
  for (const [chave, v] of cache) if (agora - v.em > VALIDADE_CACHE) cache.delete(chave)
  if (cache.size > 50) cache.delete(cache.keys().next().value!)
  // Só guarda o que não muda: a nota lida, ou a verificação (tentar de novo logo é inútil).
  if (consulta.resultado === 'ok' || consulta.resultado === 'verificacao') cache.set(url, { em: agora, consulta })
}

/** Busca a página da nota seguindo redirecionamentos só dentro do host da SEFAZ. */
async function buscarPagina(inicial: string): Promise<{ html: string; url: string }> {
  let url = inicial
  for (let saltos = 0; saltos < 5; saltos++) {
    const resposta = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TEMPO_LIMITE),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; grocery-ops)', Accept: 'text/html' },
    })
    if (resposta.status >= 300 && resposta.status < 400) {
      const destino = urlDaNfce(new URL(resposta.headers.get('location') ?? '', url).toString())
      if (!destino) throw new Error('Redirecionamento para fora da SEFAZ')
      url = destino
      continue
    }
    if (!resposta.ok) throw new Error(`SEFAZ respondeu ${resposta.status}`)
    const corpo = await resposta.arrayBuffer()
    if (corpo.byteLength > TAMANHO_MAXIMO) throw new Error('Página grande demais')
    return { html: new TextDecoder('utf-8').decode(corpo), url }
  }
  throw new Error('Redirecionamentos demais')
}

export async function consultarNfce(url: string): Promise<Consulta> {
  const guardada = cache.get(url)
  if (guardada && Date.now() - guardada.em <= VALIDADE_CACHE) return guardada.consulta
  const consulta = await chamadaExterna('nfce.consulta', { 'server.address': HOST }, async (span) => {
    try {
      const { html, url: final } = await buscarPagina(url)
      const pagina = lerPaginaNfce(html, final)
      span.setAttribute('nfce.resultado', pagina.tipo)
      if (pagina.tipo === 'nota') {
        span.setAttribute('nfce.itens', pagina.nota.itens.length)
        return { resultado: 'ok', nota: pagina.nota } as Consulta
      }
      if (pagina.tipo === 'desconhecida') return { resultado: 'erro', mensagem: MENSAGENS.desconhecida } as Consulta
      return { resultado: pagina.tipo, mensagem: MENSAGENS[pagina.tipo] } as Consulta
    } catch (e) {
      registrarErro(span, e)
      const mensagem = e instanceof Error && e.name === 'TimeoutError' ? 'A SEFAZ demorou demais para responder.' : 'Não consegui consultar a SEFAZ.'
      return { resultado: 'erro', mensagem } as Consulta
    }
  })
  guardarNoCache(url, consulta)
  log('info', 'nfce consultada', { resultado: consulta.resultado })
  return consulta
}

/** Grava a nota lida na compra (substitui uma leitura anterior) e aprende o CNPJ do mercado. */
export async function gravarNota(tx: Sql, compraId: number, nota: NotaLida, url: string) {
  const [outra] = await tx`select id, data from compra where chave_nfce = ${nota.chave} and id <> ${compraId}`
  if (outra) erro(409, 'Esta nota já está em outra compra', { compraId: outra.id })
  await tx`
    update compra set chave_nfce = ${nota.chave}, nfce_url = ${url}, nfce_emitente = ${nota.emitente},
      nfce_emitida_em = ${nota.emitidaEm}, desconto_nota_centavos = ${nota.desconto},
      total_nota_centavos = ${nota.aPagar > 0 ? nota.aPagar : null}, nfce_conferida_em = null
    where id = ${compraId}
  `
  await tx`delete from nfce_item where compra_id = ${compraId}`
  for (const l of nota.itens) {
    await tx`
      insert into nfce_item (compra_id, ordem, codigo, descricao, quantidade, unidade, unitario_centavos, total_centavos)
      values (${compraId}, ${l.ordem}, ${l.codigo}, ${l.descricao}, ${l.quantidade}, ${l.unidade}, ${l.unitario}, ${l.total})
    `
  }
  await tx`
    update mercado set cnpj = ${nota.cnpj}
    where id = (select mercado_id from compra where id = ${compraId}) and cnpj is null
      and not exists (select 1 from mercado where cnpj = ${nota.cnpj})
  `
}

/** Nota que não pôde ser lida: guarda o link (e a chave, se o QR a traz) para tentar depois. */
export async function guardarPendente(sql: Sql, compraId: number, url: string) {
  const chave = lerChave(url)?.chave ?? null
  await sql`
    update compra set nfce_url = ${url},
      chave_nfce = case when ${chave}::text is not null
        and not exists (select 1 from compra where chave_nfce = ${chave} and id <> ${compraId})
        then ${chave} else chave_nfce end
    where id = ${compraId}
  `
}

async function anotados(sql: Sql, compraId: number): Promise<(ItemAnotado & { precoCheio: number | null })[]> {
  const linhas = await sql`
    select ci.id, ci.item_id, i.nome, ci.variante, ci.quantidade, ci.preco_unitario_centavos as preco_unitario,
      ci.preco_cheio_centavos as preco_cheio, ci.embalagem_qtd, ci.embalagem_unidade
    from compra_item ci join item i on i.id = ci.item_id
    where ci.compra_id = ${compraId}
    order by ci.id
  `
  return linhas.map((l) => ({
    id: l.id as number,
    itemId: l.itemId as number,
    nome: l.nome as string,
    variante: l.variante as string | null,
    quantidade: Number(l.quantidade),
    precoUnitario: l.precoUnitario as number,
    precoCheio: l.precoCheio as number | null,
    embalagem: embalagemDe(l.embalagemQtd, l.embalagemUnidade),
  }))
}

async function linhasDaNota(sql: Sql, compraId: number) {
  const linhas = await sql`
    select ordem, codigo, descricao, quantidade, unidade, unitario_centavos as unitario,
      total_centavos as total, compra_item_id
    from nfce_item where compra_id = ${compraId} order by ordem
  `
  return linhas.map((l) => ({
    ordem: l.ordem as number,
    codigo: l.codigo as string | null,
    descricao: l.descricao as string,
    quantidade: Number(l.quantidade),
    unidade: l.unidade as string,
    unitario: l.unitario as number,
    total: l.total as number,
    compraItemId: l.compraItemId as number | null,
  }))
}

export async function conferencia(sql: Sql, compraId: number): Promise<ConferenciaNota> {
  const [c] = await sql`
    select mercado_id, chave_nfce, nfce_url, nfce_emitente, nfce_emitida_em, desconto_nota_centavos,
      total_nota_centavos, nfce_conferida_em
    from compra where id = ${compraId}
  `
  if (!c) erro(404, 'Compra não encontrada')
  const linhas = await linhasDaNota(sql, compraId)
  const doApp = await anotados(sql, compraId)
  const conferida = Boolean(c.nfceConferidaEm) && linhas.length > 0
  let pares = new Map<number, { compraItemId: number; nivel: LinhaConferencia['nivel'] }>()
  // Código já confirmado neste mercado: casa com o anotado e, sem anotado, sugere o item.
  const codigos = await sql`
    select ic.codigo, ic.item_id, i.nome from item_codigo ic join item i on i.id = ic.item_id
    where ic.mercado_id = ${c.mercadoId as number}
  `
  const nomeDoCodigo = new Map(codigos.map((x) => [x.codigo as string, x.nome as string]))
  if (conferida) {
    pares = new Map(linhas.filter((l) => l.compraItemId).map((l) => [l.ordem, { compraItemId: l.compraItemId!, nivel: 'confirmado' }]))
  } else if (linhas.length) {
    const casamento = casarNota(linhas, doApp, new Map(codigos.map((x) => [x.codigo as string, x.itemId as number])))
    pares = new Map(casamento.pares.map((p) => [p.ordem, { compraItemId: p.compraItemId, nivel: p.nivel }]))
  }
  const usados = new Set([...pares.values()].map((p) => p.compraItemId))
  const desconto = c.descontoNotaCentavos as number | null
  return {
    estado: linhas.length ? (conferida ? 'conferida' : 'lida') : c.nfceUrl ? 'pendente' : 'sem_nota',
    url: c.nfceUrl as string | null,
    chave: c.chaveNfce as string | null,
    emitente: c.nfceEmitente as string | null,
    emitidaEm: c.nfceEmitidaEm ? (c.nfceEmitidaEm as Date).toISOString() : null,
    total: linhas.length ? linhas.reduce((s, l) => s + l.total, 0) : null,
    desconto,
    aPagar: linhas.length ? (c.totalNotaCentavos as number | null) : null,
    linhas: linhas.map(({ compraItemId: _c, ...l }) => ({
      ...l,
      embalagem: unidadeDaNota(l.unidade) === 'un' ? embalagemDaDescricao(l.descricao) : null,
      nomeSugerido: (l.codigo && nomeDoCodigo.get(l.codigo)) || nomeDaDescricao(l.descricao),
      compraItemId: pares.get(l.ordem)?.compraItemId ?? null,
      nivel: pares.get(l.ordem)?.nivel ?? null,
    })),
    anotadosSemPar: doApp.filter((a) => !usados.has(a.id)).map((a) => a.id),
  }
}

/**
 * Aplica a conferência: os pares recebem quantidade, preço e embalagem da nota; as linhas
 * não anotadas entram na compra; os anotados marcados em `remover` saem dela.
 */
export async function confirmarConferencia(sql: Sql, compraId: number, decisoes: DecisaoLinha[], remover: number[]) {
  await sql.begin(async (tx) => {
    const [c] = await tx`select mercado_id, desconto_nota_centavos from compra where id = ${compraId}`
    if (!c) erro(404, 'Compra não encontrada')
    const linhas = new Map((await linhasDaNota(tx, compraId)).map((l) => [l.ordem, l]))
    if (!linhas.size) erro(409, 'A compra não tem nota lida')
    const doApp = new Map((await anotados(tx, compraId)).map((a) => [a.id, a]))
    const temDesconto = ((c.descontoNotaCentavos as number | null) ?? 0) > 0
    const usados = new Set<number>()
    await tx`update nfce_item set compra_item_id = null where compra_id = ${compraId}`

    for (const d of decisoes) {
      const linha = linhas.get(d.ordem)
      if (!linha) erro(400, `Linha ${d.ordem} não existe na nota`)
      if (d.ignorar) continue
      const un = unidadeDaNota(linha.unidade)
      const daNota = un === 'un' ? embalagemDaDescricao(linha.descricao) : null
      let compraItemId: number
      let itemId: number
      if (d.compraItemId) {
        const anotado = doApp.get(d.compraItemId)
        if (!anotado) erro(400, 'Item anotado não pertence a esta compra')
        if (usados.has(anotado.id) || remover.includes(anotado.id)) erro(400, `${anotado.nome} está em duas linhas`)
        const { preco, precoCheio } = precoConferido(linha.unitario, anotado, temDesconto)
        const embalagem = un === 'un' ? (anotado.embalagem ?? daNota) : null
        await tx`
          update compra_item set unidade = ${un}, quantidade = ${linha.quantidade}, preco_unitario_centavos = ${preco},
            preco_cheio_centavos = ${precoCheio}, total_centavos = ${totalItem(linha.quantidade, preco)},
            embalagem_qtd = ${embalagem?.qtd ?? null}, embalagem_unidade = ${embalagem?.unidade ?? null}
          where id = ${anotado.id}
        `
        compraItemId = anotado.id
        itemId = anotado.itemId
      } else {
        const item = await resolverItem(tx, {
          itemId: d.itemId ?? null,
          nome: d.nome ?? null,
          categoriaId: d.categoriaId ?? null,
          unidade: un,
        })
        const [criado] = await tx`
          insert into compra_item (compra_id, item_id, unidade, quantidade, preco_unitario_centavos, da_lista,
            total_centavos, embalagem_qtd, embalagem_unidade)
          values (${compraId}, ${item.id}, ${un}, ${linha.quantidade}, ${linha.unitario}, false,
            ${totalItem(linha.quantidade, linha.unitario)}, ${daNota?.qtd ?? null}, ${daNota?.unidade ?? null})
          returning id
        `
        compraItemId = criado!.id as number
        itemId = item.id
      }
      usados.add(compraItemId)
      if (daNota) {
        await tx`
          update item set embalagem_qtd = ${daNota.qtd}, embalagem_unidade = ${daNota.unidade}
          where id = ${itemId} and embalagem_qtd is null
        `
      }
      await tx`update nfce_item set compra_item_id = ${compraItemId} where compra_id = ${compraId} and ordem = ${linha.ordem}`
      if (linha.codigo) {
        await tx`
          insert into item_codigo (mercado_id, codigo, item_id) values (${c.mercadoId as number}, ${linha.codigo}, ${itemId})
          on conflict (mercado_id, codigo) do update set item_id = excluded.item_id
        `
      }
    }
    const fora = remover.filter((id) => doApp.has(id) && !usados.has(id))
    if (fora.length) await tx`delete from compra_item where compra_id = ${compraId} and id in ${tx(fora)}`
    await tx`update compra set nfce_conferida_em = now() where id = ${compraId}`
  })
}

/** Data da compra (AAAA-MM-DD em SP) a partir da emissão da nota. */
export function diaDaEmissao(nota: NotaLida): string {
  return nota.emitidaEm ? hojeSP(new Date(nota.emitidaEm)) : hojeSP()
}
