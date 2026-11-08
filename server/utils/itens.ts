import type { Unidade } from '../../shared/types/api'
import type { Sql } from './db'

interface ItemBanco {
  id: number
  nome: string
  categoriaId: number
  unidade: Unidade
}

/**
 * Item pelo id ou pelo nome (casado pelo nome normalizado). Cria o item se o nome é novo;
 * nesse caso a categoria é obrigatória e a resposta 422 traz `precisaCategoria`.
 */
export async function resolverItem(
  sql: Sql,
  entrada: { itemId?: number | null; nome?: string | null; categoriaId?: number | null; unidade?: Unidade | null },
): Promise<ItemBanco> {
  if (entrada.itemId) {
    const [item] = await sql`select id, nome, categoria_id, unidade from item where id = ${entrada.itemId}`
    if (!item) erro(404, 'Item não encontrado')
    return item as unknown as ItemBanco
  }
  const nome = entrada.nome ? limparNome(entrada.nome) : ''
  if (!nome) erro(400, 'nome é obrigatório')
  const chave = normalizarNome(nome)
  const [existente] = await sql`select id, nome, categoria_id, unidade from item where nome_normalizado = ${chave}`
  if (existente) return existente as unknown as ItemBanco
  if (!entrada.categoriaId) erro(422, 'Escolha a categoria do item novo', { precisaCategoria: true })
  const [categoria] = await sql`select id from categoria where id = ${entrada.categoriaId}`
  if (!categoria) erro(400, 'Categoria não encontrada')
  const [criado] = await sql`
    insert into item (nome, nome_normalizado, categoria_id, unidade)
    values (${nome}, ${chave}, ${entrada.categoriaId}, ${entrada.unidade ?? 'un'})
    on conflict (nome_normalizado) do update set nome_normalizado = excluded.nome_normalizado
    returning id, nome, categoria_id, unidade
  `
  return criado as unknown as ItemBanco
}

/**
 * Junta `origem` em `destino` dentro de uma transação: compras e lista passam para o
 * destino e a origem some. Se os dois estão abertos na lista, fica só o do destino, com a
 * prioridade e a seleção "nesta ida" somadas.
 */
export async function juntarItem(tx: Sql, origem: number, destino: number) {
  if (destino === origem) erro(400, 'Escolha outro item')
  const encontrados = await tx`select id from item where id in ${tx([origem, destino])}`
  if (encontrados.length !== 2) erro(404, 'Item não encontrado')
  await tx`update compra_item set item_id = ${destino} where item_id = ${origem}`
  const [abertoOrigem] = await tx`select id, prioritario, nesta_ida from lista_item where item_id = ${origem} and status = 'aberto'`
  const [abertoDestino] = await tx`select id from lista_item where item_id = ${destino} and status = 'aberto'`
  if (abertoOrigem && abertoDestino) {
    await tx`
      update lista_item set
        prioritario = prioritario or ${abertoOrigem.prioritario as boolean},
        nesta_ida = nesta_ida or ${abertoOrigem.nestaIda as boolean}
      where id = ${abertoDestino.id as number}
    `
    await tx`update lista_item set status = 'removido', resolvido_em = now() where id = ${abertoOrigem.id as number}`
  }
  await tx`update lista_item set item_id = ${destino} where item_id = ${origem}`
  // A embalagem habitual do destino prevalece; sem ela, herda a da origem.
  await tx`
    update item d set embalagem_qtd = o.embalagem_qtd, embalagem_unidade = o.embalagem_unidade
    from item o where d.id = ${destino} and o.id = ${origem} and d.embalagem_qtd is null
  `
  await tx`delete from item where id = ${origem}`
}
