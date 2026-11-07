// Datas de calendário em America/Sao_Paulo (o container roda em UTC). Dias como texto
// AAAA-MM-DD; a aritmética usa Date em UTC só como calendário.
const TZ = 'America/Sao_Paulo'
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

export function hojeSP(agora = new Date()): string {
  return formato.format(agora)
}

const paraData = (dia: string) => new Date(`${dia}T00:00:00Z`)
const paraDia = (data: Date) => data.toISOString().slice(0, 10)

export function somarDias(dia: string, n: number): string {
  const d = paraData(dia)
  d.setUTCDate(d.getUTCDate() + n)
  return paraDia(d)
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86_400_000)
}

export function ultimoDiaDoMes(dia: string): string {
  const d = paraData(dia)
  return paraDia(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
}

/** Período de budget: a semana (seg–dom) que contém `dia`, cortada no mês. */
export function periodoDe(dia: string) {
  const d = paraData(dia)
  const diaDaSemana = (d.getUTCDay() + 6) % 7 // segunda = 0
  const segunda = somarDias(dia, -diaDaSemana)
  const domingo = somarDias(segunda, 6)
  const primeiro = `${dia.slice(0, 7)}-01`
  const fimCiclo = ultimoDiaDoMes(dia)
  const inicio = segunda < primeiro ? primeiro : segunda
  const fim = domingo > fimCiclo ? fimCiclo : domingo
  return {
    inicio,
    fim,
    fimCiclo,
    dias: diasEntre(inicio, fim) + 1,
    diasAteFimCiclo: diasEntre(inicio, fimCiclo) + 1,
  }
}

/** Meio-dia no fuso de SP: instante usado para compras importadas com só a data. */
export function meioDiaSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`)
}

export function validarDia(texto: unknown): string | null {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null
  const data = paraData(texto)
  return !Number.isNaN(data.getTime()) && paraDia(data) === texto ? texto : null
}
