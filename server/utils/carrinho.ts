import type { Sql } from './db'

/** Campos de uma linha do carrinho, validados. Preços em centavos. */
export function lerLinhaCarrinho(corpo: Record<string, unknown> | undefined) {
  const un = unidade(corpo?.unidade)
  const quantidade = numero(corpo?.quantidade, 'quantidade', { positivo: true })
  const preco = inteiro(corpo?.precoUnitario, 'preço', { min: 0 })
  const precoCheio = inteiro(corpo?.precoCheio, 'preço cheio', { min: 0 })
  const variante = texto(corpo?.variante, 'variante', { max: 80 })
  if (quantidade !== null && Math.round(quantidade * 1000) / 1000 !== quantidade) {
    erro(400, 'quantidade com mais de 3 casas decimais')
  }
  const embalagem = embalagemEntrada(corpo?.embalagem)
  // Preço depois (#52): a linha entra com a estimativa e fica marcada até alguém informar.
  const precoPendente = booleano(corpo?.precoPendente, 'precoPendente') ?? false
  // Unidades de um item por kg (#51): só informativo, o total sai do peso.
  const unidades = inteiro(corpo?.unidades, 'unidades', { min: 1 })
  return { unidade: un, quantidade, preco, precoCheio, variante, embalagem, precoPendente, unidades }
}

/**
 * Preço estimado de um item sem preço informado: o último neste mercado, senão o de outro
 * mercado, senão 0. Não vira referência (referencias() ignora linhas com preço pendente).
 */
export async function precoEstimado(sql: Sql, itemId: number, mercadoId: number): Promise<number> {
  const refs = await referencias(sql)
  return (refs.get(`${itemId}:${mercadoId}`) ?? referenciaOutroMercado(refs, itemId, mercadoId))?.preco ?? 0
}

export async function compraEditavel(sql: Sql, id: number) {
  const compra = await buscarCompra(sql, id)
  if (compra.status === 'cancelada') erro(409, 'Compra cancelada')
  return compra
}
