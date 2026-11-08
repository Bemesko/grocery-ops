// Datas de calendário em America/Sao_Paulo (o container roda em UTC). Dias como texto
// AAAA-MM-DD; a aritmética usa Date em UTC só como calendário. Roda no servidor e no front.
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

/** 0 = segunda … 6 = domingo. */
export function diaDaSemana(dia: string): number {
  return (paraData(dia).getUTCDay() + 6) % 7
}

/** Meio-dia no fuso de SP: instante usado para compras importadas com só a data. */
export function meioDiaSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`)
}

/** Início do dia em SP (o Brasil não tem horário de verão desde 2019). */
export function inicioDoDiaSP(dia: string): Date {
  return new Date(`${dia}T00:00:00-03:00`)
}

export function validarDia(texto: unknown): string | null {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null
  const data = paraData(texto)
  return !Number.isNaN(data.getTime()) && paraDia(data) === texto ? texto : null
}

// ---------------------------------------------------------------------------------------
// Semanas de budget (docs/produto-v1.md, "Budget").
//
// A semana é de segunda a domingo e é identificada pela segunda. Uma compra feita na
// segunda ou na terça é da semana corrente; de quarta a domingo, da semana seguinte. Assim,
// as compras da semana W são as feitas de quarta (W − 5) a terça (W + 1): a "janela".
// A semana pertence ao ciclo do VR (mês) em que cai o dia preferencial de ir ao mercado
// dentro da janela. O dinheiro de uma compra é o do mês da data da compra: se a semana dela
// é de outro ciclo, a compra vai para a primeira (ou a última) semana do próprio mês.

/** Dia preferencial padrão: sexta (0 = segunda). */
export const DIA_PREFERIDO_PADRAO = 4

export const NOMES_DIAS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const

/** Segunda da semana a que se destina uma compra feita em `dia`. */
export function semanaDaCompra(dia: string): string {
  const ds = diaDaSemana(dia)
  const segunda = somarDias(dia, -ds)
  return ds <= 1 ? segunda : somarDias(segunda, 7)
}

/** Data do dia preferencial `p` dentro da janela de compras da semana `segunda`. */
export function diaPreferidoDa(segunda: string, p: number): string {
  return somarDias(segunda, -5 + ((p + 5) % 7))
}

export interface SemanaBudget {
  /** Segunda-feira da semana (seg–dom). */
  segunda: string
  /** Primeiro e último dia de compra que contam para esta semana (dentro do mês). */
  inicio: string
  fim: string
  /** Dia preferencial de ir ao mercado para esta semana. */
  diaPreferido: string
}

/** Semanas do ciclo `mes` (AAAA-MM), na ordem, com o intervalo de datas de compra de cada uma. */
export function semanasDoCiclo(mes: string, p: number): SemanaBudget[] {
  const primeiro = `${mes}-01`
  const ultimo = ultimoDiaDoMes(primeiro)
  const dias: { dia: string; segunda: string; ciclo: string }[] = []
  for (let dia = primeiro; dia <= ultimo; dia = somarDias(dia, 1)) {
    const segunda = semanaDaCompra(dia)
    dias.push({ dia, segunda, ciclo: diaPreferidoDa(segunda, p).slice(0, 7) })
  }
  const doCiclo = [...new Set(dias.filter((d) => d.ciclo === mes).map((d) => d.segunda))]
  const semanas = new Map<string, SemanaBudget>()
  for (const d of dias) {
    const segunda = d.ciclo === mes ? d.segunda : d.ciclo < mes ? doCiclo[0]! : doCiclo.at(-1)!
    const s = semanas.get(segunda)
    if (s) s.fim = d.dia
    else semanas.set(segunda, { segunda, inicio: d.dia, fim: d.dia, diaPreferido: diaPreferidoDa(segunda, p) })
  }
  return [...semanas.values()]
}

/** Semana de budget de uma compra feita em `dia`, já presa ao mês do dia. */
export function semanaEfetiva(dia: string, p: number): SemanaBudget {
  return semanasDoCiclo(dia.slice(0, 7), p).find((s) => s.inicio <= dia && dia <= s.fim)!
}
