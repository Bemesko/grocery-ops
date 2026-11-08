import postgres from 'postgres'
import { migracoes } from '../db/migracoes'

export type Sql = postgres.Sql<Record<string, unknown>>

let conexao: Sql | null = null
let pronto: Promise<void> | null = null

/** 503 que o front reconhece (`data.semBanco`) e mostra como faixa fixa, não como erro solto. */
export function erroSemBanco(message = 'Banco de dados indisponível') {
  return createError({ statusCode: 503, message, data: { semBanco: true } })
}

// Erros do driver `postgres` e do Node que significam "não deu para falar com o banco".
const CODIGOS_SEM_BANCO = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
])

export function ehFalhaDeConexao(erro: unknown): boolean {
  let atual = erro as { code?: string; cause?: unknown; errors?: unknown[] } | undefined
  for (let i = 0; atual && i < 5; i++) {
    if (atual.code && CODIGOS_SEM_BANCO.has(atual.code)) return true
    if (atual.errors?.some(ehFalhaDeConexao)) return true
    atual = atual.cause as typeof atual
  }
  return false
}

function conectar(): Sql {
  if (conexao) return conexao
  const url = process.env.DATABASE_URL
  if (!url) throw erroSemBanco('Banco de dados não configurado')
  conexao = instrumentarSql(postgres(url, {
    max: 5,
    onnotice: () => {},
    // colunas snake_case no banco, camelCase no JS
    transform: postgres.camel,
    types: {
      // count/sum de int voltam como bigint; os valores cabem em Number.
      int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      // `date` como texto AAAA-MM-DD, sem virar meia-noite UTC.
      dia: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  }) as unknown as Sql)
  return conexao
}

async function migrar(sql: Sql) {
  await sql.begin(async (tx) => {
    // Duas réplicas subindo juntas não aplicam a mesma migração duas vezes.
    await tx`select pg_advisory_xact_lock(7316001)`
    await tx`create table if not exists migracao (id text primary key, aplicada_em timestamptz not null default now())`
    const feitas = new Set((await tx`select id from migracao`).map((r) => r.id as string))
    for (const m of migracoes) {
      if (feitas.has(m.id)) continue
      await tx.unsafe(m.sql)
      await tx`insert into migracao (id) values (${m.id})`
      log('info', 'migração aplicada', { migracao: m.id })
    }
  })
}

/** Conexão pronta para uso, com o schema migrado. */
export async function useDb(): Promise<Sql> {
  const sql = conectar()
  if (!pronto) {
    pronto = migrar(sql).catch((erro) => {
      pronto = null
      throw erro
    })
  }
  try {
    await pronto
  } catch (erro) {
    log('error', 'banco indisponível', { erro: String(erro) })
    throw erroSemBanco()
  }
  return sql
}
