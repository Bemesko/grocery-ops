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
