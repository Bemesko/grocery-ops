// Períodos da tela de Gastos: mês (AAAA-MM), trimestre (AAAA-Tn), semestre (AAAA-Sn) e ano
// (AAAA). Usado pela API e pela tela, para navegar e consultar do mesmo jeito.
import { ultimoDiaDoMes } from './datas.ts'

export type TipoPeriodo = 'mes' | 'trimestre' | 'semestre' | 'ano'

const MESES_POR_TIPO: Record<TipoPeriodo, number> = { mes: 1, trimestre: 3, semestre: 6, ano: 12 }

/** Tipo de um período, ou null se o texto não é um período válido. */
export function tipoDoPeriodo(p: string): TipoPeriodo | null {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return 'mes'
  if (/^\d{4}-T[1-4]$/.test(p)) return 'trimestre'
  if (/^\d{4}-S[12]$/.test(p)) return 'semestre'
  if (/^\d{4}$/.test(p)) return 'ano'
  return null
}

export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7)
}

/** Primeiro mês (AAAA-MM) do período. */
export function primeiroMes(p: string): string {
  const tipo = tipoDoPeriodo(p)
  const ano = p.slice(0, 4)
  if (tipo === 'trimestre') return `${ano}-${String((Number(p.slice(-1)) - 1) * 3 + 1).padStart(2, '0')}`
  if (tipo === 'semestre') return `${ano}-${p.slice(-1) === '1' ? '01' : '07'}`
  if (tipo === 'ano') return `${ano}-01`
  return p
}

/** Meses (AAAA-MM) do período, em ordem. */
export function mesesDoPeriodo(p: string): string[] {
  const tipo = tipoDoPeriodo(p)!
  const primeiro = primeiroMes(p)
  return Array.from({ length: MESES_POR_TIPO[tipo] }, (_, i) => somarMeses(primeiro, i))
}

/** Primeiro e último dia (AAAA-MM-DD) do período. */
export function limitesDoPeriodo(p: string): { inicio: string; fim: string } {
  const meses = mesesDoPeriodo(p)
  return { inicio: `${meses[0]}-01`, fim: ultimoDiaDoMes(`${meses.at(-1)}-01`) }
}

/** Período do mesmo tipo `n` períodos adiante (ou atrás, se negativo). */
export function somarPeriodos(p: string, n: number): string {
  const tipo = tipoDoPeriodo(p)!
  if (tipo === 'mes') return somarMeses(p, n)
  if (tipo === 'ano') return String(Number(p) + n)
  const por = tipo === 'trimestre' ? 4 : 2
  const letra = tipo === 'trimestre' ? 'T' : 'S'
  const indice = Number(p.slice(0, 4)) * por + Number(p.slice(-1)) - 1 + n
  return `${Math.floor(indice / por)}-${letra}${(indice % por) + 1}`
}

/** O período de `tipo` que contém o mês (AAAA-MM). */
export function periodoDoMes(mes: string, tipo: TipoPeriodo): string {
  const ano = mes.slice(0, 4)
  const m = Number(mes.slice(5, 7))
  if (tipo === 'mes') return mes
  if (tipo === 'trimestre') return `${ano}-T${Math.ceil(m / 3)}`
  if (tipo === 'semestre') return `${ano}-S${m <= 6 ? 1 : 2}`
  return ano
}
