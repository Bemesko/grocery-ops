// Validação mínima dos corpos de requisição, sem biblioteca.
import type { Unidade } from '../../shared/types/api'

export function erro(statusCode: number, message: string, data?: Record<string, unknown>): never {
  throw createError({ statusCode, message, data })
}

export function idDaRota(event: Parameters<typeof getRouterParam>[0], nome = 'id'): number {
  const id = Number(getRouterParam(event, nome))
  if (!Number.isInteger(id) || id <= 0) erro(400, 'id inválido')
  return id
}

export function texto(valor: unknown, campo: string, { obrigatorio = false, max = 200 } = {}): string | null {
  if (valor === undefined || valor === null || (typeof valor === 'string' && !valor.trim())) {
    if (obrigatorio) erro(400, `${campo} é obrigatório`)
    return null
  }
  if (typeof valor !== 'string') erro(400, `${campo} deve ser texto`)
  const s = valor.replace(/\s+/g, ' ').trim()
  if (s.length > max) erro(400, `${campo} passa de ${max} caracteres`)
  return s
}

export function inteiro(valor: unknown, campo: string, { obrigatorio = false, min = 0 } = {}): number | null {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatorio) erro(400, `${campo} é obrigatório`)
    return null
  }
  const n = Number(valor)
  if (!Number.isInteger(n) || n < min) erro(400, `${campo} inválido`)
  return n
}

export function numero(valor: unknown, campo: string, { obrigatorio = false, positivo = false } = {}): number | null {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatorio) erro(400, `${campo} é obrigatório`)
    return null
  }
  const n = Number(valor)
  if (!Number.isFinite(n) || (positivo && n <= 0)) erro(400, `${campo} inválido`)
  return n
}

export function unidade(valor: unknown): Unidade | null {
  if (valor === undefined || valor === null) return null
  if (valor !== 'un' && valor !== 'kg') erro(400, 'unidade deve ser un ou kg')
  return valor
}

export function booleano(valor: unknown, campo: string): boolean | null {
  if (valor === undefined || valor === null) return null
  if (typeof valor !== 'boolean') erro(400, `${campo} deve ser verdadeiro ou falso`)
  return valor
}
