import type { GastoItem, Gastos } from '../../../shared/types/api'

/**
 * Gastos de um mês (o ciclo do VR) ou de um trimestre civil.
 * ?periodo=AAAA-MM | AAAA-Tn (T1 = jan–mar); o antigo ?mes=AAAA-MM continua valendo.
 * Padrão: o mês atual.
 */
export default defineEventHandler(async (event): Promise<Gastos> => {
  const q = getQuery(event)
  const consulta = typeof q.periodo === 'string' ? q.periodo : typeof q.mes === 'string' ? q.mes : ''
  const hoje = hojeSP()
  let tipo: Gastos['tipo'] = 'mes'
  let periodo = hoje.slice(0, 7)
  let inicio: string
  let fim: string
  const tri = /^(\d{4})-T([1-4])$/.exec(consulta)
  if (tri) {
    tipo = 'trimestre'
    periodo = consulta
    const primeiroMes = (Number(tri[2]) - 1) * 3 + 1
    inicio = `${tri[1]}-${String(primeiroMes).padStart(2, '0')}-01`
    fim = ultimoDiaDoMes(`${tri[1]}-${String(primeiroMes + 2).padStart(2, '0')}-01`)
  } else {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(consulta)) periodo = consulta
    inicio = `${periodo}-01`
    fim = ultimoDiaDoMes(inicio)
  }

  const sql = await useDb()
  const linhas = await sql`
    select ci.item_id, i.nome, ci.unidade, ci.quantidade, ci.total_centavos as total, ci.da_lista,
      i.categoria_id, cat.nome as categoria, m.nome as mercado, c.id as compra_id,
      to_char(c.data, 'YYYY-MM') as mes
    from compra c
      join compra_item ci on ci.compra_id = c.id
      join item i on i.id = ci.item_id
      join categoria cat on cat.id = i.categoria_id
      join mercado m on m.id = c.mercado_id
    where c.status = 'finalizada' and c.data between ${inicio} and ${fim}
  `

  // Agregações em memória: um período tem no máximo algumas centenas de linhas.
  const somar = <K>(mapa: Map<K, number>, k: K, v: number) => mapa.set(k, (mapa.get(k) ?? 0) + v)
  const porItem = new Map<number, GastoItem & { categoriaId: number }>()
  const porCategoria = new Map<number, { categoriaId: number; categoria: string; total: number }>()
  const porMercado = new Map<string, number>()
  const porMes = new Map<string, number>()
  const compras = new Set<number>()
  let total = 0
  let fora = 0
  let conhecido = 0
  for (const l of linhas) {
    const valor = l.total as number
    total += valor
    compras.add(l.compraId as number)
    if (l.daLista !== null) conhecido += valor
    if (l.daLista === false) fora += valor
    somar(porMercado, l.mercado as string, valor)
    somar(porMes, l.mes as string, valor)
    const cat = porCategoria.get(l.categoriaId as number) ?? {
      categoriaId: l.categoriaId as number,
      categoria: l.categoria as string,
      total: 0,
    }
    cat.total += valor
    porCategoria.set(cat.categoriaId, cat)
    const item = porItem.get(l.itemId as number) ?? {
      itemId: l.itemId as number,
      nome: l.nome as string,
      categoriaId: l.categoriaId as number,
      total: 0,
      quantidade: 0,
      unidade: l.unidade as GastoItem['unidade'],
    }
    item.total += valor
    item.quantidade = Math.round((item.quantidade + (l.quantidade as number)) * 1000) / 1000
    porItem.set(item.itemId, item)
  }
  const itensOrdenados = [...porItem.values()].sort((a, b) => b.total - a.total)
  const semCategoria = ({ categoriaId: _c, ...i }: GastoItem & { categoriaId: number }): GastoItem => i

  const meses = await sql`
    select distinct to_char(data, 'YYYY-MM') as mes from compra where status = 'finalizada' order by mes desc
  `
  const mesesDoPeriodo: string[] = []
  for (let d = inicio; d <= fim; d = somarDias(ultimoDiaDoMes(d), 1)) mesesDoPeriodo.push(d.slice(0, 7))

  return {
    tipo,
    periodo,
    inicio,
    fim,
    meses: meses.map((m) => m.mes as string),
    total,
    compras: compras.size,
    porMes: mesesDoPeriodo.map((mes) => ({ mes, total: porMes.get(mes) ?? 0 })),
    porCategoria: [...porCategoria.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, itens: itensOrdenados.filter((i) => i.categoriaId === c.categoriaId).map(semCategoria) })),
    porMercado: [...porMercado.entries()].map(([mercado, t]) => ({ mercado, total: t })).sort((a, b) => b.total - a.total),
    topItens: itensOrdenados.slice(0, 10).map(semCategoria),
    foraDaLista: { total: fora, conhecido },
    semanas: tipo === 'mes' && periodo <= hoje.slice(0, 7) ? await semanasDoMes(sql, periodo, hoje) : null,
  }
})
