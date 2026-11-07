import type { Gastos } from '../../../shared/types/api'

// Gastos de um mês (o ciclo do VR): ?mes=AAAA-MM, padrão = mês atual.
export default defineEventHandler(async (event): Promise<Gastos> => {
  const consulta = getQuery(event).mes
  const mes = typeof consulta === 'string' && /^\d{4}-\d{2}$/.test(consulta) ? consulta : hojeSP().slice(0, 7)
  const inicio = `${mes}-01`
  const fim = ultimoDiaDoMes(inicio)
  const sql = await useDb()
  const linhas = () => sql`
    select ci.*, i.nome, cat.nome as categoria, m.nome as mercado
    from compra c
      join compra_item ci on ci.compra_id = c.id
      join item i on i.id = ci.item_id
      join categoria cat on cat.id = i.categoria_id
      join mercado m on m.id = c.mercado_id
    where c.status = 'finalizada' and c.data between ${inicio} and ${fim}
  `
  const [totais] = await sql`
    select coalesce(sum(ci.total_centavos), 0)::int8 as total, count(distinct c.id)::int8 as compras,
      coalesce(sum(ci.total_centavos) filter (where ci.da_lista = false), 0)::int8 as fora,
      coalesce(sum(ci.total_centavos) filter (where ci.da_lista is not null), 0)::int8 as conhecido
    from compra c join compra_item ci on ci.compra_id = c.id
    where c.status = 'finalizada' and c.data between ${inicio} and ${fim}
  `
  const porCategoria = await sql`
    select l.categoria, sum(l.total_centavos)::int8 as total from (${linhas()}) l
    group by l.categoria order by total desc
  `
  const porMercado = await sql`
    select l.mercado, sum(l.total_centavos)::int8 as total from (${linhas()}) l
    group by l.mercado order by total desc
  `
  const topItens = await sql`
    select l.item_id, l.nome, sum(l.total_centavos)::int8 as total, sum(l.quantidade) as quantidade,
      max(l.unidade) as unidade
    from (${linhas()}) l
    group by l.item_id, l.nome order by total desc limit 10
  `
  const meses = await sql`
    select distinct to_char(data, 'YYYY-MM') as mes from compra where status = 'finalizada' order by mes desc
  `
  return {
    mes,
    meses: meses.map((m) => m.mes as string),
    total: totais!.total as number,
    compras: totais!.compras as number,
    porCategoria: porCategoria as unknown as Gastos['porCategoria'],
    porMercado: porMercado as unknown as Gastos['porMercado'],
    topItens: topItens as unknown as Gastos['topItens'],
    foraDaLista: { total: totais!.fora as number, conhecido: totais!.conhecido as number },
  }
})
