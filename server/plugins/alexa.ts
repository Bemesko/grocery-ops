// Puxa a lista de compras da Alexa (via Home Assistant) a cada minuto, se configurada.
// Ver server/utils/alexa.ts.
export default defineNitroPlugin((nitro) => {
  if (!configAlexa()) {
    log('info', 'Lista da Alexa desligada: defina HA_URL, HA_TOKEN e HA_TODO_ENTITY para ligar')
    return
  }
  const rodar = () => {
    useDb()
      .then((sql) => sincronizarAlexa(sql))
      .catch(() => {}) // sem banco: a próxima rodada tenta de novo
  }
  // ALEXA_PERIODO_MS só existe para os testes de integração: 0 desliga as rodadas
  // automáticas, e o teste chama POST /api/alexa/sincronizar quando quer.
  const periodo = Number(process.env.ALEXA_PERIODO_MS ?? 60_000)
  if (periodo <= 0) return
  const timer = setInterval(rodar, periodo)
  setTimeout(rodar, 5_000)
  nitro.hooks.hook('close', () => clearInterval(timer))
})
