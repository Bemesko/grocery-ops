// Liga o span HTTP (criado pela instrumentação do node:http) à rota do Nitro: o span ganha
// o nome "GET /api/compras/:id" e a métrica http.server.request.duration ganha o http.route.
// Erros 5xx viram exceção no span e linha de log.
import { context, trace } from '@opentelemetry/api'
import { RPCType, getRPCMetadata } from '@opentelemetry/core'
import type { H3Event } from 'h3'

function marcarRota(event: H3Event) {
  const rota = (event.context.matchedRoute as { path?: string } | undefined)?.path
  if (!rota) return
  const span = trace.getActiveSpan()
  span?.updateName(`${event.method} ${rota}`)
  span?.setAttribute('http.route', rota)
  const rpc = getRPCMetadata(context.active())
  if (rpc?.type === RPCType.HTTP) rpc.route = rota
}

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('beforeResponse', marcarRota)

  // Respostas de erro (4xx inclusive) não passam pelo beforeResponse.
  nitro.hooks.hook('error', (erro, { event }) => {
    if (event) marcarRota(event)
    const status = (erro as { statusCode?: number }).statusCode ?? 500
    if (status < 500) return
    registrarErro(trace.getActiveSpan(), erro)
    log('error', erro.message, { path: event?.path, method: event?.method, status })
  })
})
