import type { GastoItem, Gastos } from '../../../shared/types/api'
import { baseDe, conteudoBase, embalagemDe, type BaseEmbalagem } from '../../../shared/utils/embalagem'
import { limitesDoPeriodo, mesesDoPeriodo, somarMeses, tipoDoPeriodo } from '../../../shared/utils/periodos'

/**
 * Gastos de um mês (o ciclo do VR), trimestre, semestre ou ano civil.
 * ?periodo=AAAA-MM | AAAA-Tn (T1 = jan–mar) | AAAA-Sn (S1 = jan–jun) | AAAA; o antigo
 * ?mes=AAAA-MM continua valendo. Padrão: o mês atual. Meses futuros trazem a projeção (#67).
 */
export default defineEventHandler(async (event): Promise<Gastos> => {
  const q = getQuery(event)
  const consulta = typeof q.periodo === 'string' ? q.periodo : typeof q.mes === 'string' ? q.mes : ''
  const hoje = hojeSP()
  const mesAtual = hoje.slice(0, 7)
  const periodo = tipoDoPeriodo(consulta) ? consulta : mesAtual
  const tipo = tipoDoPeriodo(periodo)!
  const { inicio, fim } = limitesDoPeriodo(periodo)

  const sql = await useDb()
  const linhas = await sql`
    select ci.item_id, i.nome, ci.unidade, ci.quantidade, ci.total_centavos as total, ci.da_lista,
      coalesce(ci.embalagem_qtd, i.embalagem_qtd)::float8 as emb_qtd,
      coalesce(ci.embalagem_unidade, i.embalagem_unidade) as emb_unidade,
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
  type ItemAgregado = GastoItem & { categoriaId: number; semConteudo?: boolean }
  const porItem = new Map<number, ItemAgregado>()
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
      conteudo: null,
    }
    item.total += valor
    item.quantidade = Math.round((item.quantidade + (l.quantidade as number)) * 1000) / 1000
    // #71: conteúdo total (kg ou L) das linhas em unidades que têm embalagem. Uma linha sem
    // embalagem, ou de outra natureza (kg × L), tira o item da soma: não dá para somar.
    if (l.unidade === 'un' && !item.semConteudo) {
      const emb = embalagemDe(l.embQtd, l.embUnidade)
      const base: BaseEmbalagem | null = emb ? baseDe(emb.unidade) : null
      if (!emb || base === 'un' || (item.conteudo && item.conteudo.base !== base)) {
        item.semConteudo = true
        item.conteudo = null
      } else {
        const qtd = (item.conteudo?.qtd ?? 0) + (l.quantidade as number) * conteudoBase(emb)
        item.conteudo = { qtd: Math.round(qtd * 1000) / 1000, base }
      }
    }
    porItem.set(item.itemId, item)
  }
  // #48: o total oficial de cada compra é o da nota. A diferença entre a nota e os itens
  // entra nos totais (do período, do mês e do mercado) e numa linha própria das
  // categorias, sem ser distribuída entre os itens.
  const totaisDasCompras = await sql`
    select ct.compra_id, ct.total - ct.itens as diferenca, m.nome as mercado, to_char(c.data, 'YYYY-MM') as mes,
      not exists (select 1 from compra_item x where x.compra_id = c.id) as sem_itens
    from compra c join compra_total ct on ct.compra_id = c.id join mercado m on m.id = c.mercado_id
    where c.status = 'finalizada' and c.data between ${inicio} and ${fim}
  `
  let diferencaNota = 0
  let semItens = 0
  for (const c of totaisDasCompras) {
    compras.add(c.compraId as number)
    const d = Number(c.diferenca)
    if (!d) continue
    if (c.semItens) semItens += d
    else diferencaNota += d
    total += d
    somar(porMercado, c.mercado as string, d)
    somar(porMes, c.mes as string, d)
  }
  // #65: compras registradas só pelo total (sem itens) ficam numa linha própria.
  if (semItens) porCategoria.set(-1, { categoriaId: -1, categoria: 'Compras sem itens', total: semItens })
  if (diferencaNota) {
    porCategoria.set(0, { categoriaId: 0, categoria: 'Diferença da nota', total: diferencaNota })
  }
  const itensOrdenados = [...porItem.values()].sort((a, b) => b.total - a.total)
  const semCategoria = ({ categoriaId: _c, semConteudo: _s, ...i }: ItemAgregado): GastoItem => i

  const meses = await sql`
    select distinct to_char(data, 'YYYY-MM') as mes from compra where status = 'finalizada' order by mes desc
  `

  // Semana a semana só para um mês: o passado e o atual pelo que foi gasto; os futuros (até
  // 12 meses) pela projeção da recarga mensal.
  let semanas: Gastos['semanas'] = null
  let saldo: number | null = null
  let projecao = false
  if (tipo === 'mes') {
    if (periodo <= mesAtual) {
      const r = await semanasDoMes(sql, periodo, hoje)
      semanas = r.semanas
      saldo = r.saldo
    } else if (periodo <= somarMeses(mesAtual, 12)) {
      projecao = true
      const recarga = await recargaMensal(sql)
      semanas = await semanasProjetadas(sql, periodo, recarga)
      saldo = recarga
    }
  }

  return {
    tipo,
    periodo,
    inicio,
    fim,
    meses: meses.map((m) => m.mes as string),
    total,
    compras: compras.size,
    porMes: mesesDoPeriodo(periodo).map((mes) => ({ mes, total: porMes.get(mes) ?? 0 })),
    porCategoria: [...porCategoria.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, itens: itensOrdenados.filter((i) => i.categoriaId === c.categoriaId).map(semCategoria) })),
    porMercado: [...porMercado.entries()].map(([mercado, t]) => ({ mercado, total: t })).sort((a, b) => b.total - a.total),
    topItens: itensOrdenados.slice(0, 10).map(semCategoria),
    foraDaLista: { total: fora, conhecido },
    semanas,
    saldo,
    projecao,
  }
})
