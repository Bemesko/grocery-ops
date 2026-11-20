// Regras de budget de docs/produto-v1.md ("Orçamento"). O servidor monta a base (saldo e
// semana); o front projeta o efeito de uma compra a cada item registrado.

export interface BaseBudget {
  configurado: boolean
  /** Saldo atual do VR: último ajuste − compras finalizadas depois dele. */
  saldo: number
  /** Compras finalizadas que contam para a semana atual. */
  gastoPeriodo: number
  /** saldo + gastoPeriodo: o saldo no início da semana. */
  saldoInicioPeriodo: number
  /** Segunda-feira da semana atual (seg–dom). */
  semana: string
  /** Datas de compra que contam para a semana atual (AAAA-MM-DD). */
  inicio: string
  fim: string
  /** Dia preferencial de ir ao mercado para a semana atual. */
  diaPreferido: string
  /** Último dia do ciclo do VR (o dia 1 seguinte recarrega). */
  fimCiclo: string
  /** Semanas do ciclo a partir da atual, inclusive. */
  semanasRestantes: number
}

export interface ProjecaoBudget {
  budget: number
  usado: number
  restante: number
  excedeu: boolean
  /** Budget de cada semana que falta se a atual gastar exatamente o budget. */
  semanalNormal: number | null
  /** Budget de cada semana que falta depois desta, gastando `usado`. */
  proximasSemanas: number | null
  semanasDepois: number
  saldoApos: number
  faltaSaldo: boolean
  ultimoPeriodo: boolean
}

/** `compra`: total da compra em andamento (ainda fora de gastoPeriodo). */
export function projetarBudget(b: BaseBudget, compra = 0): ProjecaoBudget {
  const n = Math.max(1, b.semanasRestantes)
  const budget = Math.round(b.saldoInicioPeriodo / n)
  const usado = b.gastoPeriodo + compra
  const depois = n - 1
  return {
    budget,
    usado,
    restante: budget - usado,
    excedeu: usado > budget,
    semanalNormal: depois > 0 ? budget : null,
    proximasSemanas: depois > 0 ? Math.round((b.saldoInicioPeriodo - usado) / depois) : null,
    semanasDepois: depois,
    saldoApos: b.saldo - compra,
    faltaSaldo: compra > b.saldo,
    ultimoPeriodo: depois <= 0,
  }
}

export interface SemanaEvolucao {
  segunda: string
  inicio: string
  fim: string
  diaPreferido: string
  /** Semana da ida atrasada do mês anterior (compra entre o dia 1 e a primeira janela). */
  atrasada?: boolean
  /** Budget da semana pelo saldo do ciclo; null se o ciclo não tem ajuste de saldo. */
  budget: number | null
  gasto: number
  situacao: 'passada' | 'atual' | 'futura'
}

/**
 * Budget × gasto de cada semana de um ciclo. O saldo no início de cada semana é reconstruído
 * de trás para frente: `saldoFim` (saldo depois de todas as compras do ciclo até agora) mais
 * o que foi gasto da semana em diante. Assim o mês passado é visto com o saldo corrigido
 * pelos ajustes, e a semana atual bate com o cabeçalho da lista.
 */
export function evolucaoSemanas(
  semanas: { segunda: string; inicio: string; fim: string; diaPreferido: string; atrasada?: boolean }[],
  gastoPorSemana: Map<string, number>,
  saldoFim: number | null,
  hoje: string,
): SemanaEvolucao[] {
  const situacao = (s: { inicio: string; fim: string }) =>
    s.fim < hoje ? 'passada' : s.inicio > hoje ? 'futura' : 'atual'
  let gastoDali = 0
  const resultado: SemanaEvolucao[] = []
  for (let i = semanas.length - 1; i >= 0; i--) {
    const s = semanas[i]!
    const gasto = gastoPorSemana.get(s.segunda) ?? 0
    gastoDali += gasto
    const budget = saldoFim === null ? null : Math.round((saldoFim + gastoDali) / (semanas.length - i))
    resultado.unshift({ ...s, budget, gasto, situacao: situacao(s) })
  }
  // A semana atual guarda o orçamento inteiro dela até acabar (#64): uma compra pequena antes
  // da ida principal não pode jogar o saldo todo nas semanas futuras. Elas dividem o que
  // sobra do saldo do início da semana atual depois de reservar o orçamento dela; o que a
  // atual gastar a mais ou a menos só passa adiante quando ela termina.
  const futuras = resultado.filter((s) => s.situacao === 'futura')
  const atual = resultado.find((s) => s.situacao === 'atual')
  if (saldoFim !== null && futuras.length) {
    const reservado = atual?.budget ?? 0
    const saldoDeAtual = saldoFim + (atual?.gasto ?? 0)
    for (const s of futuras) s.budget = Math.round((saldoDeAtual - reservado) / futuras.length)
  }
  return resultado
}
