import type { BaseBudget } from '../../shared/utils/budget'
import type { Sql } from './db'

/**
 * Saldo e período de budget de hoje (docs/produto-v1.md, "Budget").
 *
 * O ajuste de saldo pode ser feito em qualquer dia: ele só corrige o saldo. O gasto do
 * período conta todas as compras da semana, inclusive as feitas antes do ajuste (que já
 * estão descontadas no saldo informado). Assim o saldo do início do período é
 * `saldo atual + gasto do período`, e o ajuste não devolve à semana o que ela já gastou.
 */
export async function baseBudget(sql: Sql, hoje = hojeSP()): Promise<BaseBudget> {
  const periodo = periodoDe(hoje)
  const [ajuste] = await sql`
    select em, saldo_centavos from saldo_ajuste order by em desc, id desc limit 1
  `
  if (!ajuste) {
    return { configurado: false, saldo: 0, gastoPeriodo: 0, saldoInicioPeriodo: 0, ...periodo }
  }
  const [r] = await sql`
    select
      coalesce(sum(t.total) filter (where t.finalizada_em > ${ajuste.em as Date}), 0)::int8 as gasto_desde_ajuste,
      coalesce(sum(t.total) filter (where t.data between ${periodo.inicio} and ${periodo.fim}), 0)::int8
        as gasto_periodo
    from (
      select c.data, c.finalizada_em, sum(ci.total_centavos) as total
      from compra c join compra_item ci on ci.compra_id = c.id
      where c.status = 'finalizada'
        and (c.finalizada_em > ${ajuste.em as Date} or c.data between ${periodo.inicio} and ${periodo.fim})
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
    ...periodo,
  }
}
