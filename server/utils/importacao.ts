// Importação de histórico por CSV (docs/produto-v1.md, "Importação de histórico").
import type { Unidade } from '../../shared/types/api'
import type { Embalagem } from '../../shared/utils/embalagem'
import type { Sql } from './db'

const OBRIGATORIAS = ['data', 'mercado', 'item', 'categoria', 'unidade', 'quantidade', 'preco_unitario'] as const

export interface LinhaImportada {
  linha: number
  data: string
  mercado: string
  item: string
  categoriaId: number
  unidade: Unidade
  quantidade: number
  preco: number
  variante: string | null
  embalagem: Embalagem | null
  precoCheio: number | null
  daLista: boolean | null
  totalNota: number | null
  compra: string
}

export interface PreviaImportacao {
  linhas: LinhaImportada[]
  erros: { linha: number; mensagem: string }[]
  compras: { chave: string; data: string; mercado: string; itens: number; total: number; totalNota: number | null }[]
  itensNovos: string[]
  mercadosNovos: string[]
}

function simNao(valor: string): boolean | null | undefined {
  const v = normalizarNome(valor)
  if (!v) return null
  if (['sim', 's', 'true', '1', 'x'].includes(v)) return true
  if (['nao', 'n', 'false', '0'].includes(v)) return false
  return undefined
}

export async function analisarCsv(sql: Sql, conteudo: string): Promise<PreviaImportacao> {
  const [cabecalho, ...dados] = lerCsv(conteudo)
  const erros: PreviaImportacao['erros'] = []
  if (!cabecalho) return { linhas: [], erros: [{ linha: 1, mensagem: 'Arquivo vazio' }], compras: [], itensNovos: [], mercadosNovos: [] }
  const colunas = cabecalho.map((c) => normalizarNome(c).replace(/ /g, '_'))
  const faltando = OBRIGATORIAS.filter((c) => !colunas.includes(c))
  if (faltando.length) {
    return {
      linhas: [],
      erros: [{ linha: 1, mensagem: `Colunas obrigatórias faltando: ${faltando.join(', ')}` }],
      compras: [],
      itensNovos: [],
      mercadosNovos: [],
    }
  }

  const categorias = new Map(
    (await sql`select id, nome from categoria`).map((c) => [normalizarNome(c.nome as string), c.id as number]),
  )
  const itensExistentes = new Set((await sql`select nome_normalizado from item`).map((i) => i.nomeNormalizado as string))
  const mercadosExistentes = new Set((await sql`select nome from mercado`).map((m) => normalizarNome(m.nome as string)))

  const linhas: LinhaImportada[] = []
  dados.forEach((valores, i) => {
    const n = i + 2 // linha no arquivo (o cabeçalho é a 1)
    const v = (col: string) => (valores[colunas.indexOf(col)] ?? '').trim()
    const problemas: string[] = []
    const data = validarDia(v('data'))
    if (!data) problemas.push('data deve ser AAAA-MM-DD')
    const categoriaId = categorias.get(normalizarNome(v('categoria')))
    if (!categoriaId) problemas.push(`categoria "${v('categoria')}" não existe`)
    const unidade = normalizarNome(v('unidade'))
    if (unidade !== 'un' && unidade !== 'kg') problemas.push('unidade deve ser un ou kg')
    const quantidade = parseNumero(v('quantidade'))
    if (!quantidade || quantidade <= 0) problemas.push('quantidade inválida')
    const preco = parseDinheiro(v('preco_unitario'))
    if (preco === null || preco < 0) problemas.push('preco_unitario inválido')
    const precoCheio = v('preco_cheio') ? parseDinheiro(v('preco_cheio')) : null
    if (v('preco_cheio') && precoCheio === null) problemas.push('preco_cheio inválido')
    const embalagem = v('embalagem') ? lerEmbalagem(v('embalagem')) : null
    if (v('embalagem') && !embalagem) problemas.push('embalagem inválida (ex.: 800 g, 1 L, 12 un)')
    const totalNota = v('total_nota') ? parseDinheiro(v('total_nota')) : null
    if (v('total_nota') && totalNota === null) problemas.push('total_nota inválido')
    const daLista = simNao(v('da_lista'))
    if (daLista === undefined) problemas.push('da_lista deve ser sim, não ou vazio')
    if (!v('mercado')) problemas.push('mercado vazio')
    if (!v('item')) problemas.push('item vazio')
    if (problemas.length) {
      erros.push({ linha: n, mensagem: problemas.join('; ') })
      return
    }
    linhas.push({
      linha: n,
      data: data!,
      mercado: limparNome(v('mercado')),
      item: limparNome(v('item')),
      categoriaId: categoriaId!,
      unidade: unidade as Unidade,
      quantidade: Math.round(quantidade! * 1000) / 1000,
      preco: preco!,
      variante: v('variante') || null,
      embalagem: unidade === 'kg' ? null : embalagem,
      precoCheio,
      daLista: daLista ?? null,
      totalNota,
      compra: v('compra'),
    })
  })

  const compras = new Map<string, PreviaImportacao['compras'][number]>()
  for (const l of linhas) {
    const chave = chaveCompra(l)
    const c = compras.get(chave) ?? { chave, data: l.data, mercado: l.mercado, itens: 0, total: 0, totalNota: null }
    c.itens++
    c.total += totalItem(l.quantidade, l.preco)
    c.totalNota ??= l.totalNota
    compras.set(chave, c)
  }
  const itensNovos = [...new Map(linhas.filter((l) => !itensExistentes.has(normalizarNome(l.item))).map((l) => [normalizarNome(l.item), l.item])).values()]
  const mercadosNovos = [...new Map(linhas.filter((l) => !mercadosExistentes.has(normalizarNome(l.mercado))).map((l) => [normalizarNome(l.mercado), l.mercado])).values()]
  return {
    linhas,
    erros,
    compras: [...compras.values()].sort((a, b) => a.data.localeCompare(b.data)),
    itensNovos,
    mercadosNovos,
  }
}

function chaveCompra(l: LinhaImportada) {
  return `${l.data}|${normalizarNome(l.mercado)}|${l.compra}`
}

export async function gravarImportacao(sql: Sql, arquivo: string, previa: PreviaImportacao): Promise<number> {
  return sql.begin(async (tx) => {
    const [imp] = await tx`insert into importacao (arquivo) values (${arquivo}) returning id`
    const importacaoId = imp!.id as number
    const mercados = new Map<string, number>()
    const itens = new Map<string, number>()
    const compras = new Map<string, number>()
    for (const l of previa.linhas) {
      const chaveMercado = normalizarNome(l.mercado)
      let mercadoId = mercados.get(chaveMercado)
      if (!mercadoId) {
        const existentes = await tx`select id, nome from mercado`
        const achado = existentes.find((m) => normalizarNome(m.nome as string) === chaveMercado)
        mercadoId = achado
          ? (achado.id as number)
          : ((await tx`insert into mercado (nome) values (${l.mercado}) returning id`)[0]!.id as number)
        mercados.set(chaveMercado, mercadoId)
      }
      const chaveItem = normalizarNome(l.item)
      let itemId = itens.get(chaveItem)
      if (!itemId) {
        const [item] = await tx`
          insert into item (nome, nome_normalizado, categoria_id, unidade)
          values (${l.item}, ${chaveItem}, ${l.categoriaId}, ${l.unidade})
          on conflict (nome_normalizado) do update set nome_normalizado = excluded.nome_normalizado
          returning id
        `
        itemId = item!.id as number
        itens.set(chaveItem, itemId)
      }
      const chave = chaveCompra(l)
      let compraId = compras.get(chave)
      if (!compraId) {
        const resumo = previa.compras.find((c) => c.chave === chave)
        const [compra] = await tx`
          insert into compra (mercado_id, status, data, iniciada_em, finalizada_em, total_nota_centavos, origem, importacao_id)
          values (${mercadoId}, 'finalizada', ${l.data}, ${meioDiaSP(l.data)}, ${meioDiaSP(l.data)},
            ${resumo?.totalNota ?? null}, 'importacao', ${importacaoId})
          returning id
        `
        compraId = compra!.id as number
        compras.set(chave, compraId)
      }
      await tx`
        insert into compra_item (compra_id, item_id, variante, unidade, quantidade, preco_unitario_centavos,
          preco_cheio_centavos, da_lista, total_centavos, embalagem_qtd, embalagem_unidade)
        values (${compraId}, ${itemId}, ${l.variante}, ${l.unidade}, ${l.quantidade}, ${l.preco},
          ${l.precoCheio}, ${l.daLista}, ${totalItem(l.quantidade, l.preco)},
          ${l.embalagem?.qtd ?? null}, ${l.embalagem?.unidade ?? null})
      `
      // Como no mercado: a primeira embalagem conhecida vira a habitual do item.
      if (l.embalagem) {
        await tx`
          update item set embalagem_qtd = ${l.embalagem.qtd}, embalagem_unidade = ${l.embalagem.unidade}
          where id = ${itemId} and embalagem_qtd is null
        `
      }
    }
    return importacaoId
  })
}
