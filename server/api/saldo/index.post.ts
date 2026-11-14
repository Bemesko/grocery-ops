// "Ajustar saldo": o saldo somado dos VRs num momento. Compras finalizadas antes dele
// deixam de mexer no saldo. Sem `dia` (ou com hoje), o momento é agora; com um dia
// passado, é o início dele em SP: assim dá para registrar a recarga do dia 1 de um mês
// antigo, e as compras daquele dia (importadas ao meio-dia) saem desse saldo.
export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const saldo = inteiro(corpo?.saldo, 'saldo', { obrigatorio: true, min: 0 })!
  const hoje = hojeSP()
  let em = new Date()
  if (corpo?.dia !== undefined && corpo?.dia !== null && corpo?.dia !== '') {
    const dia = validarDia(corpo.dia) ?? erro(400, 'dia inválido')
    if (dia > hoje) erro(400, 'o dia do ajuste não pode ser no futuro')
    if (dia < hoje) em = inicioDoDiaSP(dia)
  }
  const sql = await useDb()
  await sql`insert into saldo_ajuste (em, saldo_centavos) values (${em}, ${saldo})`
  return { budget: await baseBudget(sql) }
})
