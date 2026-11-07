// Rota de exemplo da API. A sincronização das listas entre celulares vai crescer aqui.
export default defineEventHandler(() => ({
  version: useRuntimeConfig().appVersion,
}))
