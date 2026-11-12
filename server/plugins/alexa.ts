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
  const timer = setInterval(rodar, 60_000)
  setTimeout(rodar, 5_000)
  nitro.hooks.hook('close', () => clearInterval(timer))
})
