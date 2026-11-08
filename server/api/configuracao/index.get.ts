import type { Configuracao } from '../../../shared/types/api'

export default defineEventHandler(async (): Promise<Configuracao> => {
  const sql = await useDb()
  return { diaPreferido: await diaPreferido(sql) }
})
