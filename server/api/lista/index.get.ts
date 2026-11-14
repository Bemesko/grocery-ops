import type { ListaItem, Mercado, RespostaLista } from '../../../shared/types/api'
import type { Referencia } from '../../utils/precos'

export default defineEventHandler(async (): Promise<RespostaLista> => {
  const sql = await useDb()
  const itens = await sql`
    select li.id, li.item_id, i.nome, i.categoria_id, i.unidade, li.quantidade, li.prioritario,
      li.nesta_ida, li.criado_em, li.origem, li.variante
    from lista_item li join item i on i.id = li.item_id
    where li.status = 'aberto'
    order by li.prioritario desc, i.nome
  `
  const mercados = (await sql`select id, nome from mercado order by nome`) as unknown as Mercado[]
  const refs = await referencias(sql)
  const quantidades = await ultimasQuantidades(sql)
  const habituais = await embalagensHabituais(sql)
  const [atual] = await sql`
    select c.id, c.mercado_id, m.nome as mercado
    from compra c join mercado m on m.id = c.mercado_id where c.status = 'em_andamento'
  `
  return {
    itens: itens.map((li) => {
      const qtd = quantidadeEstimada(li.quantidade as string | null, quantidades.get(li.itemId as number))
      const estimativas: Record<string, number> = {}
      const porConteudo: number[] = []
      const doItem = mercados.flatMap((m) => refs.get(`${li.itemId}:${m.id}`) ?? [])
      // Pacotes de tamanhos diferentes (#12): estima todos os mercados na mesma embalagem,
      // a habitual do item ou, sem ela, a da compra mais recente.
      const base = habituais.get(li.itemId as number) ?? maisRecenteComEmbalagem(doItem)
      for (const ref of doItem) {
        estimativas[ref.mercadoId] = totalItem(qtd, precoNaEmbalagem(ref.preco, ref.embalagem, base))
        if (ref.embalagem && base && mesmaBase(ref.embalagem, base) && !mesmoConteudo(ref.embalagem, base)) {
          porConteudo.push(ref.mercadoId)
        }
      }
      return { ...(li as unknown as ListaItem), estimativas, porConteudo }
    }),
    mercados,
    budget: await baseBudget(sql),
    compraAtual: (atual as unknown as RespostaLista['compraAtual']) ?? null,
  }
})

function maisRecenteComEmbalagem(refs: Referencia[]) {
  let melhor: Referencia | null = null
  for (const r of refs) if (r.embalagem && (!melhor || r.finalizadaEm > melhor.finalizadaEm)) melhor = r
  return melhor?.embalagem ?? null
}
