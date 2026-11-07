// Aplica as migrações na subida, sem travar o servidor: /healthz responde mesmo com o banco
// fora do ar (o CNPG pode demorar a ficar pronto), e as rotas da API tentam de novo.
export default defineNitroPlugin(() => {
  if (!process.env.DATABASE_URL) {
    console.warn('[db] DATABASE_URL não configurada: a API vai responder 503')
    return
  }
  const tentar = (tentativa: number) => {
    useDb().catch(() => {
      const espera = Math.min(30, 2 ** tentativa)
      setTimeout(() => tentar(tentativa + 1), espera * 1000)
    })
  }
  tentar(0)
})
