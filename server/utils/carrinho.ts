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
  return { unidade: un, quantidade, preco, precoCheio, variante }
}

export async function compraEditavel(sql: Sql, id: number) {
  const compra = await buscarCompra(sql, id)
  if (compra.status === 'cancelada') erro(409, 'Compra cancelada')
  return compra
}
