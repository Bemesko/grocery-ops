import type { Sql } from './db'

/** Dia da semana preferido para ir ao mercado (0 = segunda … 6 = domingo). */
export async function diaPreferido(sql: Sql): Promise<number> {
  const [linha] = await sql`select valor from configuracao where chave = 'dia_preferido'`
  const p = Number(linha?.valor)
  return Number.isInteger(p) && p >= 0 && p <= 6 ? p : DIA_PREFERIDO_PADRAO
}
