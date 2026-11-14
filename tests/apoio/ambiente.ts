// Ambiente dos testes de integração e do Playwright: um banco Postgres novo, o Home
// Assistant e a SEFAZ falsos e o build de produção do app (.output, gerado por
// `make build-app`) numa porta livre. Cada arquivo de teste sobe o seu, isolado.
//
// TESTE_DATABASE_URL aponta para um Postgres onde o usuário pode criar bancos (o do
// `make db` localmente, o serviço do job no CI).
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import postgres from 'postgres'
import { ENTIDADE_HA, TOKEN_HA, iniciarHaFalso, type HaFalso } from './ha-falso.ts'
import { iniciarSefazFalsa, type SefazFalsa } from './sefaz-falsa.ts'

const RAIZ = new URL('../../', import.meta.url).pathname
const SERVIDOR = `${RAIZ}.output/server/index.mjs`
const URL_ADMIN = process.env.TESTE_DATABASE_URL ?? 'postgres://app:app@127.0.0.1:5432/app'

export interface Ambiente {
  /** Endereço do app, sem barra no fim. */
  url: string
  /** Endereço e cliente direto do banco do teste (para preparar e conferir dados). */
  urlBanco: string
  sql: postgres.Sql
  ha: HaFalso
  sefaz: SefazFalsa
  /** Apaga os dados entre os testes (categorias, migrações e configuração ficam). */
  limpar(): Promise<void>
  encerrar(): Promise<void>
}

async function portaLivre(): Promise<number> {
  return new Promise((ok, falha) => {
    const s = net.createServer()
    s.once('error', falha)
    s.listen(0, '127.0.0.1', () => {
      const porta = (s.address() as net.AddressInfo).port
      s.close(() => ok(porta))
    })
  })
}

async function esperar(url: string, processo: ChildProcess, log: string[]) {
  const limite = Date.now() + 60_000
  while (Date.now() < limite) {
    if (processo.exitCode !== null) throw new Error(`O app saiu (${processo.exitCode}):\n${log.join('')}`)
    try {
      // /api/categorias só responde depois das migrações aplicadas.
      const r = await fetch(`${url}/api/categorias`)
      if (r.ok) return
    } catch {
      // ainda subindo
    }
    await new Promise((ok) => setTimeout(ok, 250))
  }
  throw new Error(`O app não respondeu em 60 s:\n${log.join('')}`)
}

/** Tabelas com dados de uso: limpas entre os testes, na ordem das dependências. */
export const TABELAS = [
  'alexa_importado',
  'nfce_item',
  'compra_item',
  'compra',
  'lista_item',
  'item_codigo',
  'item_alias',
  'item',
  'mercado',
  'saldo_ajuste',
  'importacao',
]

export async function iniciarAmbiente(env: Record<string, string> = {}): Promise<Ambiente> {
  if (!existsSync(SERVIDOR)) throw new Error('Falta o build do app: rode `make build-app` antes dos testes.')
  const banco = `grocery_teste_${process.pid}_${Date.now().toString(36)}`
  const admin = postgres(URL_ADMIN, { max: 1, onnotice: () => {} })
  await admin.unsafe(`create database ${banco}`)
  const urlBanco = new URL(URL_ADMIN)
  urlBanco.pathname = `/${banco}`

  const [ha, sefaz, porta] = await Promise.all([iniciarHaFalso(), iniciarSefazFalsa(), portaLivre()])
  const url = `http://127.0.0.1:${porta}`
  const log: string[] = []
  const processo = spawn(process.execPath, [SERVIDOR], {
    env: {
      PATH: process.env.PATH ?? '',
      HOST: '127.0.0.1',
      PORT: String(porta),
      TZ: 'UTC',
      DATABASE_URL: urlBanco.toString(),
      GROCERY_TESTE: '1',
      NFCE_DESTINO_TESTE: sefaz.url,
      HA_URL: ha.url,
      HA_TOKEN: TOKEN_HA,
      HA_TODO_ENTITY: ENTIDADE_HA,
      ALEXA_PERIODO_MS: '0',
      ALEXA_INTERVALO_MINIMO_MS: '0',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  processo.stdout?.on('data', (d) => log.push(String(d)))
  processo.stderr?.on('data', (d) => log.push(String(d)))
  await esperar(url, processo, log)

  const sql = postgres(urlBanco.toString(), { max: 2, onnotice: () => {} })
  return {
    url,
    urlBanco: urlBanco.toString(),
    sql,
    ha,
    sefaz,
    async limpar() {
      await sql.unsafe(`truncate ${TABELAS.join(', ')} restart identity cascade`)
      await sql`update configuracao set valor = '4' where chave = 'dia_preferido'`
      ha.itens.length = 0
      ha.chamadas.length = 0
      ha.modo = 'ok'
      sefaz.chamadas.length = 0
    },
    async encerrar() {
      processo.kill('SIGTERM')
      await new Promise((ok) => (processo.exitCode !== null ? ok(null) : processo.once('exit', ok)))
      await sql.end()
      await Promise.all([ha.fechar(), sefaz.fechar()])
      await admin.unsafe(`drop database if exists ${banco} with (force)`)
      await admin.end()
    },
  }
}
