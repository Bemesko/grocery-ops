// Liga o formatarDinheiro (shared/utils/texto.ts) ao modo "ocultar valores".
export default defineNuxtPlugin(() => {
  const { ocultos } = useOcultarValores()
  definirOcultarDinheiro(() => ocultos.value)
})
