// Telemetria do lado do app. O SDK é ligado fora do bundle (otel/instrumentation.mjs);
// aqui só se usa a API, que encontra o SDK pelo registro global. Sem SDK, tudo vira no-op.
import { SpanKind, SpanStatusCode, context, metrics, trace, type Span } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'
import type { Sql } from './db'

const tracer = trace.getTracer('grocery-ops')
const meter = metrics.getMeter('grocery-ops')

/** Métricas de negócio (viram grocery_* no Prometheus). */
export const metricas = {
  comprasFinalizadas: meter.createCounter('grocery.purchase.completed', {
    description: 'Compras finalizadas no app',
  }),
  valorCompra: meter.createHistogram('grocery.purchase.amount', {
    description: 'Total de cada compra finalizada, em reais',
    advice: { explicitBucketBoundaries: [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500] },
  }),
  itensCarrinho: meter.createCounter('grocery.cart.items', {
    description: 'Itens registrados no carrinho (from_list: veio da lista ou não)',
  }),
}

/** Log em JSON no stdout, com trace_id/span_id do span ativo para correlacionar no Grafana. */
export function log(level: 'debug' | 'info' | 'warn' | 'error', msg: string, atributos: Record<string, unknown> = {}) {
  const span = trace.getActiveSpan()?.spanContext()
  const linha = {
    time: new Date().toISOString(),
    level,
    msg,
    ...(span && trace.isSpanContextValid(span) ? { trace_id: span.traceId, span_id: span.spanId } : {}),
    ...atributos,
  }
  ;(level === 'error' ? console.error : console.log)(JSON.stringify(linha))
}

export function registrarErro(span: Span | undefined, erro: unknown) {
  if (!span) return
  span.recordException(erro instanceof Error ? erro : String(erro))
  span.setStatus({ code: SpanStatusCode.ERROR, message: erro instanceof Error ? erro.message : String(erro) })
}

/**
 * Span manual em volta de uma chamada externa cujo URL não pode ir para os traces (o link
 * da NFC-e dá acesso à nota inteira, com os dados do consumidor). A instrumentação
 * automática do fetch fica suprimida dentro de `fn`; os atributos vêm só de quem chama.
 */
export async function chamadaExterna<T>(
  nome: string,
  atributos: Record<string, string | number>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(nome, { kind: SpanKind.CLIENT, attributes: atributos }, async (span) => {
    try {
      return await context.with(suppressTracing(context.active()), () => fn(span))
    } catch (erro) {
      registrarErro(span, erro)
      throw erro
    } finally {
      span.end()
    }
  })
}

// --- Spans do Postgres -------------------------------------------------------------
// O driver `postgres` não tem instrumentação oficial: o proxy abaixo cria um span por
// consulta executada (os fragmentos sql`...` aninhados não executam e não viram span).

const atributosBase = (() => {
  const atributos: Record<string, string | number> = { 'db.system.name': 'postgresql' }
  try {
    const url = new URL(process.env.DATABASE_URL ?? '')
    atributos['server.address'] = url.hostname
    atributos['server.port'] = Number(url.port || 5432)
    atributos['db.namespace'] = url.pathname.replace(/^\//, '')
  } catch {
    // sem URL válida: só o sistema
  }
  return atributos
})()

function textoDaConsulta(partes: TemplateStringsArray | string): string {
  const texto = typeof partes === 'string' ? partes : partes.reduce((acc, parte, i) => `${acc}$${i}${parte}`)
  return texto.replace(/\s+/g, ' ').trim()
}

function nomeDoSpan(texto: string): { nome: string; operacao: string } {
  const operacao = (texto.match(/^\s*(\w+)/)?.[1] ?? 'QUERY').toUpperCase()
  const alvo = texto.match(/\b(?:from|into|update|table(?: if not exists)?)\s+("?[\w.]+"?)/i)?.[1]
  return { nome: alvo ? `${operacao} ${alvo.replace(/"/g, '')}` : operacao, operacao }
}

function comSpan<T extends PromiseLike<unknown>>(consulta: T, partes: TemplateStringsArray | string): T {
  const thenOriginal = consulta.then.bind(consulta)
  let execucao: PromiseLike<unknown> | undefined
  // A consulta do `postgres` só executa no primeiro then (await); é aí que o span começa.
  ;(consulta as { then: unknown }).then = (ok?: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => {
    if (!execucao) {
      const texto = textoDaConsulta(partes)
      const { nome, operacao } = nomeDoSpan(texto)
      const span = tracer.startSpan(nome, {
        kind: SpanKind.CLIENT,
        attributes: { ...atributosBase, 'db.operation.name': operacao, 'db.query.text': texto.slice(0, 2000) },
      })
      execucao = thenOriginal(
        (resultado) => {
          const linhas = (resultado as { count?: number })?.count
          if (typeof linhas === 'number') span.setAttribute('db.response.returned_rows', linhas)
          span.end()
          return resultado
        },
        (erro) => {
          registrarErro(span, erro)
          span.end()
          throw erro
        },
      )
    }
    return execucao.then(ok, falha)
  }
  return consulta
}

export function instrumentarSql(sql: Sql): Sql {
  return new Proxy(sql, {
    apply(alvo, este, args) {
      const resultado = Reflect.apply(alvo, este, args)
      const primeiro = args[0] as unknown
      if (Array.isArray(primeiro) && 'raw' in primeiro && resultado && typeof resultado.then === 'function') {
        return comSpan(resultado, primeiro as unknown as TemplateStringsArray)
      }
      return resultado
    },
    get(alvo, prop) {
      const valor = Reflect.get(alvo, prop, alvo)
      if (prop === 'unsafe' && typeof valor === 'function') {
        return (texto: string, ...resto: unknown[]) => comSpan(valor.call(alvo, texto, ...resto), texto)
      }
      if (prop === 'begin' && typeof valor === 'function') {
        return (...args: unknown[]) => {
          const callback = args[args.length - 1] as (tx: Sql) => unknown
          args[args.length - 1] = (tx: Sql) => callback(instrumentarSql(tx))
          return tracer.startActiveSpan(
            'BEGIN',
            { kind: SpanKind.CLIENT, attributes: { ...atributosBase, 'db.operation.name': 'BEGIN' } },
            async (span) => {
              try {
                return await valor.apply(alvo, args)
              } catch (erro) {
                registrarErro(span, erro)
                throw erro
              } finally {
                span.end()
              }
            },
          )
        }
      }
      return typeof valor === 'function' ? valor.bind(alvo) : valor
    },
  }) as Sql
}
