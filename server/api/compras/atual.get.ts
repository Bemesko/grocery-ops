import type { PendenteMercado, RespostaCompraAtual } from '../../../shared/types/api'

// Tela do mercado: carrinho, itens da lista ainda não pegos e a base do budget.
export default defineEventHandler(async (): Promise<RespostaCompraAtual> => {
  const sql = await useDb()
  const budget = await baseBudget(sql)
  const compra = await compraEmAndamento(sql)
  if (!compra) return { compra: null, itens: [], pendentes: [], budget }
  const itens = await itensDaCompra(sql, compra)
  const listaNoCarrinho = await sql`
    select lista_item_id from compra_item where compra_id = ${compra.id} and lista_item_id is not null
  `
  const jaPegos = new Set(listaNoCarrinho.map((l) => l.listaItemId as number))
  const lista = await sql`
    select li.id as lista_item_id, li.item_id, i.nome, i.categoria_id, i.unidade, li.quantidade,
      li.prioritario, li.nesta_ida
    from lista_item li join item i on i.id = li.item_id
    where li.status = 'aberto'
    order by li.prioritario desc, i.nome
  `
  const refs = await referencias(sql)
  const quantidades = await ultimasQuantidades(sql)
  const pendentes: PendenteMercado[] = lista
    .filter((l) => !jaPegos.has(l.listaItemId as number))
    .map((l) => {
      const itemId = l.itemId as number
      const ref = refs.get(`${itemId}:${compra.mercadoId}`)
      const outra = ref ? null : referenciaOutroMercado(refs, itemId, compra.mercadoId)
      const preco = ref?.preco ?? outra?.preco
      const qtd = quantidadeEstimada(l.quantidade as string | null, quantidades.get(itemId))
      return {
        ...(l as unknown as PendenteMercado),
        estimativa: preco === undefined ? null : totalItem(qtd, preco),
        estimativaOutroMercado: !ref && Boolean(outra),
      }
    })
  const { finalizadaEm: _f, ...semData } = compra
  return { compra: semData, itens, pendentes, budget }
})
