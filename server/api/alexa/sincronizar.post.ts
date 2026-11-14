// O app chama ao abrir: traz o que foi pedido para a Alexa sem esperar a próxima rodada.
// Rodada recente (menos de 15 s) não chama o HA de novo.
export default defineEventHandler(async () => {
  const atual = estadoAlexa()
  if (!atual.ligada) return atual
  // ALEXA_INTERVALO_MINIMO_MS só existe para os testes de integração.
  const minimo = Number(process.env.ALEXA_INTERVALO_MINIMO_MS ?? 15_000)
  if (atual.ultimaEm && Date.now() - new Date(atual.ultimaEm).getTime() < minimo) return { ...atual, importados: 0 }
  return sincronizarAlexa(await useDb())
})
