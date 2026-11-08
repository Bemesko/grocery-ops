import type { Reduflacao } from '../../../shared/utils/embalagem'

// Detalhe do item: último preço em cada mercado e as últimas compras.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const sql = await useDb()
  const [item] = await sql`
    select i.id, i.nome, i.categoria_id, i.unidade, i.embalagem_qtd, i.embalagem_unidade, c.nome as categoria
    from item i join categoria c on c.id = i.categoria_id where i.id = ${id}
  `
  if (!item) erro(404, 'Item não encontrado')
  const compras = await sql`
    select c.id as compra_id, c.data, m.id as mercado_id, m.nome as mercado, ci.unidade, ci.quantidade,
      ci.preco_unitario_centavos as preco_unitario, ci.preco_cheio_centavos as preco_cheio,
      ci.variante, ci.embalagem_qtd, ci.embalagem_unidade, ci.total_centavos as total
    from compra_item ci join compra c on c.id = ci.compra_id join mercado m on m.id = c.mercado_id
    where ci.item_id = ${id} and c.status = 'finalizada'
    order by c.finalizada_em desc, ci.id desc
    limit 30
  `
  // Embalagem e preço por kg/L/un; reduflação marcada contra a compra anterior no mesmo mercado.
  const linhas = compras.map(({ embalagemQtd, embalagemUnidade, ...c }) => {
    const embalagem = embalagemDe(embalagemQtd, embalagemUnidade)
    return {
      ...c,
      embalagem,
      precoBase: embalagem ? precoBase(c.precoUnitario as number, embalagem) : null,
      reduflacao: null as Reduflacao | null,
    }
  })
  for (let i = 0; i < linhas.length; i++) {
    const anterior = linhas.slice(i + 1).find((x) => x.mercadoId === linhas[i]!.mercadoId)
    if (anterior) {
      linhas[i]!.reduflacao = detectarReduflacao(
        { preco: anterior.precoUnitario as number, embalagem: anterior.embalagem },
        { preco: linhas[i]!.precoUnitario as number, embalagem: linhas[i]!.embalagem },
      )
    }
  }
  const porMercado = new Map<number, (typeof linhas)[number]>()
  for (const c of linhas) if (!porMercado.has(c.mercadoId as number)) porMercado.set(c.mercadoId as number, c)
  const { embalagemQtd, embalagemUnidade, ...dados } = item
  return {
    item: { ...dados, embalagem: embalagemDe(embalagemQtd, embalagemUnidade) },
    ultimoPorMercado: [...porMercado.values()],
    compras: linhas,
  }
})
