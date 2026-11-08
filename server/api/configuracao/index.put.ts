import type { Configuracao } from '../../../shared/types/api'

// Muda o dia preferencial; os budgets são recalculados na hora (nada fica gravado por semana).
export default defineEventHandler(async (event): Promise<Configuracao> => {
  const corpo = await readBody(event)
  const p = inteiro(corpo?.diaPreferido, 'diaPreferido', { obrigatorio: true })!
  if (p > 6) erro(400, 'diaPreferido vai de 0 (segunda) a 6 (domingo)')
  const sql = await useDb()
  await sql`
    insert into configuracao (chave, valor) values ('dia_preferido', ${String(p)}::jsonb)
    on conflict (chave) do update set valor = excluded.valor
  `
  return { diaPreferido: p }
})
