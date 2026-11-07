import type { Compra, CompraItem, ResumoCompra } from '../../shared/types/api'
import type { Sql } from './db'

export interface CompraBanco extends Compra {
  finalizadaEm: Date | null
}

export async function buscarCompra(sql: Sql, id: number): Promise<CompraBanco> {
  const [compra] = await sql`
    select c.id, c.mercado_id, m.nome as mercado, c.status, c.data, c.origem,
      c.total_nota_centavos as total_nota, c.finalizada_em,
      coalesce((select sum(total_centavos) from compra_item where compra_id = c.id), 0)::int8 as total
    from compra c join mercado m on m.id = c.mercado_id
    where c.id = ${id}
  `
  if (!compra) erro(404, 'Compra não encontrada')
  return compra as unknown as CompraBanco
}

export async function compraEmAndamento(sql: Sql): Promise<CompraBanco | null> {
  const [atual] = await sql`select id from compra where status = 'em_andamento'`
  return atual ? buscarCompra(sql, atual.id as number) : null
}

/** Resumo exibido ao fechar a compra e no histórico. */
export async function resumoCompra(sql: Sql, id: number): Promise<ResumoCompra> {
  const compra = await buscarCompra(sql, id)
  const itens = await itensDaCompra(sql, compra)
  const porValor = [...itens].sort((a, b) => b.total - a.total)
  const comVariacao = itens.filter((i) => i.variacao && Math.abs(i.variacao.percentual) >= 0.01)
  const pct = (i: CompraItem) => i.variacao!.percentual
  const fora = itens.filter((i) => i.daLista === false)
  const { finalizadaEm: _f, ...semData } = compra
  // O budget só faz sentido para compras do período atual (o saldo é o de hoje).
  const budgetHoje = await baseBudget(sql)
  const doPeriodo = budgetHoje.configurado && compra.data >= budgetHoje.inicio && compra.data <= budgetHoje.fim
  return {
    compra: semData,
    itens,
    budget: compra.status === 'finalizada' && doPeriodo ? budgetHoje : null,
    topItens: porValor.slice(0, 5),
    foraDaLista: { quantidade: fora.length, total: fora.reduce((s, i) => s + i.total, 0) },
    altas: comVariacao.filter((i) => pct(i) > 0).sort((a, b) => pct(b) - pct(a)).slice(0, 3),
    baixas: comVariacao.filter((i) => pct(i) < 0).sort((a, b) => pct(a) - pct(b)).slice(0, 3),
    divergencia: compra.totalNota ? (compra.total - compra.totalNota) / compra.totalNota : null,
  }
}
