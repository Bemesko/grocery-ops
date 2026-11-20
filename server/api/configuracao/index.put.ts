import type { Configuracao } from '../../../shared/types/api'

// Atualiza só o que veio no corpo. O dia preferencial muda os budgets na hora (nada fica
// gravado por semana); a recarga mensal (centavos, 0 = apagar) alimenta a projeção dos meses futuros.
export default defineEventHandler(async (event): Promise<Configuracao> => {
  const corpo = await readBody(event)
  const p = inteiro(corpo?.diaPreferido, 'diaPreferido')
  const recarga = inteiro(corpo?.recargaMensal, 'recargaMensal')
  if (p === null && recarga === null) erro(400, 'informe diaPreferido ou recargaMensal')
  if (p !== null && p > 6) erro(400, 'diaPreferido vai de 0 (segunda) a 6 (domingo)')
  const sql = await useDb()
  if (p !== null) {
    await sql`
      insert into configuracao (chave, valor) values ('dia_preferido', ${String(p)}::jsonb)
      on conflict (chave) do update set valor = excluded.valor
    `
  }
  if (recarga !== null) {
    if (recarga === 0) await sql`delete from configuracao where chave = 'recarga_mensal'`
    else {
      await sql`
        insert into configuracao (chave, valor) values ('recarga_mensal', ${String(recarga)}::jsonb)
        on conflict (chave) do update set valor = excluded.valor
      `
    }
  }
  return { diaPreferido: await diaPreferido(sql), recargaMensal: await recargaMensal(sql) }
})
