import type { ListaItem, Mercado, RespostaLista } from '../../../shared/types/api'

export default defineEventHandler(async (): Promise<RespostaLista> => {
  const sql = await useDb()
  const itens = await sql`
    select li.id, li.item_id, i.nome, i.categoria_id, i.unidade, li.quantidade, li.prioritario,
      li.nesta_ida, li.criado_em
    from lista_item li join item i on i.id = li.item_id
    where li.status = 'aberto'
    order by li.prioritario desc, i.nome
  `
  const mercados = (await sql`select id, nome, tipo from mercado order by nome`) as unknown as Mercado[]
  const refs = await referencias(sql)
  const quantidades = await ultimasQuantidades(sql)
  const [atual] = await sql`
    select c.id, c.mercado_id, m.nome as mercado
    from compra c join mercado m on m.id = c.mercado_id where c.status = 'em_andamento'
  `
  return {
    itens: itens.map((li) => {
      const qtd = quantidadeEstimada(li.quantidade as string | null, quantidades.get(li.itemId as number))
      const estimativas: Record<string, number> = {}
      for (const m of mercados) {
        const ref = refs.get(`${li.itemId}:${m.id}`)
        if (ref) estimativas[m.id] = totalItem(qtd, ref.preco)
      }
      return { ...(li as unknown as ListaItem), estimativas }
    }),
    mercados,
    budget: await baseBudget(sql),
    compraAtual: (atual as unknown as RespostaLista['compraAtual']) ?? null,
  }
})
