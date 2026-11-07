// Regras de budget de docs/produto-v1.md ("Budget"). O servidor monta a base (saldo e
// período); o front projeta o efeito de uma compra a cada item registrado.

export interface BaseBudget {
  configurado: boolean
  /** Saldo atual do VR: último ajuste − compras finalizadas depois dele. */
  saldo: number
  /** Compras finalizadas no período, depois do último ajuste. */
  gastoPeriodo: number
  /** saldo + gastoPeriodo: o saldo no início do período. */
  saldoInicioPeriodo: number
  /** Período = semana (seg–dom) ∩ ciclo do VR (mês). Datas AAAA-MM-DD. */
  inicio: string
  fim: string
  fimCiclo: string
  /** Dias do período. */
  dias: number
  /** Dias do início do período até o fim do ciclo. */
  diasAteFimCiclo: number
}

export interface ProjecaoBudget {
  budget: number
  usado: number
  restante: number
  excedeu: boolean
  /** Budget de uma semana cheia se o período gastar exatamente o budget. */
  semanalNormal: number | null
  /** Budget de uma semana cheia depois deste período, gastando `usado`. */
  proximasSemanas: number | null
  semanasDepois: number
  saldoApos: number
  faltaSaldo: boolean
  ultimoPeriodo: boolean
}

/** `compra`: total da compra em andamento (ainda fora de gastoPeriodo). */
export function projetarBudget(b: BaseBudget, compra = 0): ProjecaoBudget {
  const budget = Math.round((b.saldoInicioPeriodo * b.dias) / b.diasAteFimCiclo)
  const usado = b.gastoPeriodo + compra
  const diasDepois = b.diasAteFimCiclo - b.dias
  return {
    budget,
    usado,
    restante: budget - usado,
    excedeu: usado > budget,
    semanalNormal: diasDepois > 0 ? Math.round((b.saldoInicioPeriodo * 7) / b.diasAteFimCiclo) : null,
    proximasSemanas: diasDepois > 0 ? Math.round(((b.saldoInicioPeriodo - usado) * 7) / diasDepois) : null,
    semanasDepois: diasDepois / 7,
    saldoApos: b.saldo - compra,
    faltaSaldo: compra > b.saldo,
    ultimoPeriodo: diasDepois <= 0,
  }
}
