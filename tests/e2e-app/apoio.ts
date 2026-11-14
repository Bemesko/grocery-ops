// Apoio dos cenários do Playwright: endereço do app, banco limpo antes de cada teste e
// atalhos para preparar dados pela API (o que não é o foco do cenário).
import { test as base } from '@playwright/test'
import postgres from 'postgres'
import { TABELAS } from '../apoio/ambiente.ts'

export const URL_APP = process.env.E2E_APP_URL ?? ''
const sql = postgres(process.env.E2E_BANCO_URL ?? '', { max: 1, onnotice: () => {} })

export async function limparBanco() {
  await sql.unsafe(`truncate ${TABELAS.join(', ')} restart identity cascade`)
  await sql`update configuracao set valor = '4' where chave = 'dia_preferido'`
}

export async function api<T = Record<string, unknown>>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`${URL_APP}${caminho}`, {
    method: metodo,
    headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  if (!r.ok) throw new Error(`${metodo} ${caminho}: ${r.status} ${await r.text()}`)
  return (await r.json()) as T
}

export const CATEGORIA = { hortifruti: 1, padaria: 2, laticinios: 3, mercearia: 6, bebidas: 11, outros: 12 }

/** Cada cenário começa com o banco limpo e o app aberto no endereço do ambiente. */
export const test = base.extend({
  baseURL: async ({}, usar) => usar(URL_APP),
  page: async ({ page }, usar) => {
    await limparBanco()
    await usar(page)
  },
})

export { expect } from '@playwright/test'
