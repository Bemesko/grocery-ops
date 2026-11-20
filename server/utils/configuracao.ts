import type { Sql } from './db'

/** Dia da semana preferido para ir ao mercado (0 = segunda … 6 = domingo). */
export async function diaPreferido(sql: Sql): Promise<number> {
  const [linha] = await sql`select valor from configuracao where chave = 'dia_preferido'`
  const p = Number(linha?.valor)
  return Number.isInteger(p) && p >= 0 && p <= 6 ? p : DIA_PREFERIDO_PADRAO
}

/** Recarga mensal do VR em centavos (base da projeção dos meses futuros); null se não definida. */
export async function recargaMensal(sql: Sql): Promise<number | null> {
  const [linha] = await sql`select valor from configuracao where chave = 'recarga_mensal'`
  const r = Number(linha?.valor)
  return linha && Number.isInteger(r) && r > 0 ? r : null
}
