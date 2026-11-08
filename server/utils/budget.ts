import type { BaseBudget } from '../../shared/utils/budget'
import type { Sql } from './db'

/**
 * Semanas do ciclo, com a semana da ida atrasada quando houve compra (finalizada ou em
 * andamento) entre o dia 1 e o início da primeira janela do mês.
 */
export async function semanasComAtraso(sql: Sql, mes: string) {
  const p = await diaPreferido(sql)
  const cabeca = diasDaIdaAtrasada(mes, p)
  if (!cabeca) return semanasDoCiclo(mes, p)
  const [compra] = await sql`
    select 1 from compra
    where status in ('finalizada', 'em_andamento') and data between ${cabeca.inicio} and ${cabeca.fim}
    limit 1
  `
  return semanasDoCiclo(mes, p, Boolean(compra))
}

/**
 * Saldo e semana de budget de hoje (docs/produto-v1.md, "Budget").
 *
 * O ajuste de saldo pode ser feito em qualquer dia: ele só corrige o saldo. O gasto da
 * semana conta todas as compras dela, inclusive as feitas antes do ajuste (que já estão
 * descontadas no saldo informado). Assim o saldo do início da semana é
 * `saldo atual + gasto da semana`, e o ajuste não devolve à semana o que ela já gastou.
 */
export async function baseBudget(sql: Sql, hoje = hojeSP()): Promise<BaseBudget> {
  const semanas = await semanasComAtraso(sql, hoje.slice(0, 7))
  const i = semanas.findIndex((s) => s.inicio <= hoje && hoje <= s.fim)
  const s = semanas[i]!
  const semana = {
    semana: s.segunda,
    inicio: s.inicio,
    fim: s.fim,
    diaPreferido: s.diaPreferido,
    fimCiclo: ultimoDiaDoMes(hoje),
    semanasRestantes: semanas.length - i,
  }
  const [ajuste] = await sql`
    select em, saldo_centavos from saldo_ajuste order by em desc, id desc limit 1
  `
  if (!ajuste) {
    return { configurado: false, saldo: 0, gastoPeriodo: 0, saldoInicioPeriodo: 0, ...semana }
  }
  const [r] = await sql`
    select
      coalesce(sum(t.total) filter (where t.finalizada_em > ${ajuste.em as Date}), 0)::int8 as gasto_desde_ajuste,
      coalesce(sum(t.total) filter (where t.data between ${s.inicio} and ${s.fim}), 0)::int8
        as gasto_periodo
    from (
      select c.data, c.finalizada_em, sum(ci.total_centavos) as total
      from compra c join compra_item ci on ci.compra_id = c.id
      where c.status = 'finalizada'
        and (c.finalizada_em > ${ajuste.em as Date} or c.data between ${s.inicio} and ${s.fim})
      group by c.id
    ) t
  `
  const saldo = (ajuste.saldoCentavos as number) - (r!.gastoDesdeAjuste as number)
  const gastoPeriodo = r!.gastoPeriodo as number
  return {
    configurado: true,
    saldo,
    gastoPeriodo,
    saldoInicioPeriodo: saldo + gastoPeriodo,
    ...semana,
  }
}

/**
 * Budget × gasto de cada semana do ciclo `mes` (AAAA-MM). O saldo vem do último ajuste
 * feito dentro do mês (normalmente a recarga do dia 1); sem ajuste no mês, só o gasto.
 */
export async function semanasDoMes(sql: Sql, mes: string, hoje = hojeSP()) {
  const semanas = await semanasComAtraso(sql, mes)
  const inicio = `${mes}-01`
  const fim = ultimoDiaDoMes(inicio)
  const porDia = await sql`
    select c.data, sum(ci.total_centavos)::int8 as total
    from compra c join compra_item ci on ci.compra_id = c.id
    where c.status = 'finalizada' and c.data between ${inicio} and ${fim}
    group by c.data
  `
  const gastoPorSemana = new Map<string, number>()
  for (const d of porDia) {
    const s = semanas.find((x) => x.inicio <= (d.data as string) && (d.data as string) <= x.fim)!
    gastoPorSemana.set(s.segunda, (gastoPorSemana.get(s.segunda) ?? 0) + (d.total as number))
  }
  const [ajuste] = await sql`
    select em, saldo_centavos from saldo_ajuste
    where em >= ${inicioDoDiaSP(inicio)} and em < ${inicioDoDiaSP(somarDias(fim, 1))}
    order by em desc, id desc limit 1
  `
  let saldoFim: number | null = null
  if (ajuste) {
    const [r] = await sql`
      select coalesce(sum(ci.total_centavos), 0)::int8 as total
      from compra c join compra_item ci on ci.compra_id = c.id
      where c.status = 'finalizada' and c.finalizada_em > ${ajuste.em as Date} and c.data <= ${fim}
    `
    saldoFim = (ajuste.saldoCentavos as number) - (r!.total as number)
  }
  return evolucaoSemanas(semanas, gastoPorSemana, saldoFim, hoje)
}
