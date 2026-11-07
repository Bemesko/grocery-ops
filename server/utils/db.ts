import postgres from 'postgres'
import { migracoes } from '../db/migracoes'

export type Sql = postgres.Sql<Record<string, unknown>>

let conexao: Sql | null = null
let pronto: Promise<void> | null = null

function conectar(): Sql {
  if (conexao) return conexao
  const url = process.env.DATABASE_URL
  if (!url) {
    throw createError({ statusCode: 503, message: 'DATABASE_URL não configurada' })
  }
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
    throw createError({ statusCode: 503, message: 'Banco de dados indisponível' })
  }
  return sql
}
