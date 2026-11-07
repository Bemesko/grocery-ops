// OpenTelemetry do grocery-ops, carregado antes do servidor:
//   node --import ./otel/instrumentation.mjs .output/server/index.mjs
//
// Traces e métricas vão por OTLP (http/protobuf) para OTEL_EXPORTER_OTLP_ENDPOINT. Sem
// endpoint, nada é ligado. Logs NÃO vão por OTLP: o app escreve JSON no stdout (com
// trace_id) e o coletor do cluster lê os logs dos pods; mandar pelos dois caminhos
// duplicaria tudo.
//
// O resto da configuração segue as variáveis padrão do SDK (OTEL_SERVICE_NAME,
// OTEL_RESOURCE_ATTRIBUTES, OTEL_METRIC_EXPORT_INTERVAL, OTEL_TRACES_SAMPLER...).
import { register } from 'node:module'
import { createAddHookMessageChannel } from 'import-in-the-middle'

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
const desligado = process.env.OTEL_SDK_DISABLED === 'true'

function log(level, msg) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, msg }))
}

if (!endpoint || desligado) {
  log('info', 'OpenTelemetry desligado: defina OTEL_EXPORTER_OTLP_ENDPOINT para ligar')
} else {
  // Hook de ESM só para os módulos que as instrumentações pedem (aqui, node:http).
  const { registerOptions, waitForAllMessagesAcknowledged } = createAddHookMessageChannel()
  register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions)

  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-proto')
  const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-proto')
  const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics')
  const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http')
  const { UndiciInstrumentation } = await import('@opentelemetry/instrumentation-undici')
  const { RuntimeNodeInstrumentation } = await import('@opentelemetry/instrumentation-runtime-node')
  const { resourceFromAttributes } = await import('@opentelemetry/resources')

  const sdk = new NodeSDK({
    // OTEL_SERVICE_NAME e OTEL_RESOURCE_ATTRIBUTES (detector de env) têm prioridade.
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME ?? 'grocery-ops',
      'service.version': process.env.NUXT_APP_VERSION ?? 'dev',
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 60_000,
      }),
    ],
    instrumentations: [
      new HttpInstrumentation({
        // Só a API: probes, assets e a casca do PWA são ruído.
        ignoreIncomingRequestHook: (req) => !req.url?.startsWith('/api/'),
      }),
      new UndiciInstrumentation(),
      new RuntimeNodeInstrumentation(),
    ],
  })
  sdk.start()
  await waitForAllMessagesAcknowledged()
  log('info', `OpenTelemetry ligado: traces e métricas para ${endpoint}`)

  process.once('SIGTERM', () => {
    sdk.shutdown().catch((erro) => log('error', `OpenTelemetry: falha ao encerrar: ${erro}`))
  })
}
