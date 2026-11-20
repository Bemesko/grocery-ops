// Puxa a lista de compras da Alexa (via Home Assistant) a cada minuto, se configurada.
// Ver server/utils/alexa.ts.
export default defineNitroPlugin((nitro) => {
  if (!configAlexa()) {
    log('info', 'Lista da Alexa desligada: defina HA_URL, HA_TOKEN e HA_TODO_ENTITY para ligar')
    return
  }
  const rodar = () =>
    useDb()
      .then((sql) => sincronizarAlexa(sql))
      .catch(() => {}) // sem banco: a próxima rodada tenta de novo
  // ALEXA_PERIODO_MS só existe para os testes de integração: 0 desliga as rodadas
  // automáticas, e o teste chama POST /api/alexa/sincronizar quando quer.
  const periodo = Number(process.env.ALEXA_PERIODO_MS ?? 60_000)
  if (periodo <= 0) return
  // Com falhas seguidas, espaça as tentativas (1, 2, 5 e 15 min) em vez de bater no HA todo minuto.
  const ESPACOS = [60_000, 120_000, 300_000, 900_000]
  let timer: ReturnType<typeof setTimeout> | undefined
  let fechado = false
  const proxima = (ms: number) => {
    if (fechado) return
    timer = setTimeout(async () => {
      await rodar()
      const falhas = estadoAlexa().falhasSeguidas
      proxima(falhas ? Math.max(periodo, ESPACOS[Math.min(falhas, ESPACOS.length) - 1]!) : periodo)
    }, ms)
  }
  proxima(5_000)
  nitro.hooks.hook('close', () => {
    fechado = true
    clearTimeout(timer)
  })
})
