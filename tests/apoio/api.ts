// Chamadas à API do app nos testes de integração, com validação do contrato (zod).
import assert from 'node:assert/strict'
import type { z } from 'zod'

export interface Resposta<T = unknown> {
  status: number
  corpo: T
}

export function clienteApi(base: string) {
  async function pedir<T = Record<string, unknown>>(metodo: string, caminho: string, corpo?: unknown): Promise<Resposta<T>> {
    const r = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    const texto = await r.text()
    return { status: r.status, corpo: (texto ? JSON.parse(texto) : null) as T }
  }
  return {
    get: <T = Record<string, unknown>>(caminho: string) => pedir<T>('GET', caminho),
    post: <T = Record<string, unknown>>(caminho: string, corpo?: unknown) => pedir<T>('POST', caminho, corpo ?? {}),
    patch: <T = Record<string, unknown>>(caminho: string, corpo: unknown) => pedir<T>('PATCH', caminho, corpo),
    put: <T = Record<string, unknown>>(caminho: string, corpo: unknown) => pedir<T>('PUT', caminho, corpo),
    del: <T = Record<string, unknown>>(caminho: string) => pedir<T>('DELETE', caminho),
  }
}

/** Confere a resposta contra o schema do contrato e devolve o corpo tipado. */
export function conforme<S extends z.ZodType>(schema: S, resposta: Resposta, status = 200): z.infer<S> {
  assert.equal(resposta.status, status, `status ${resposta.status}: ${JSON.stringify(resposta.corpo)}`)
  const r = schema.safeParse(resposta.corpo)
  if (!r.success) assert.fail(`resposta fora do contrato:\n${JSON.stringify(r.error.issues, null, 2)}`)
  return r.data
}
