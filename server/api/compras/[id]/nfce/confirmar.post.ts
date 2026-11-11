import type { DecisaoLinha } from '../../../../../shared/types/api'

// Confirma a conferência da nota: pares, linhas que entram na compra e anotados que saem.
export default defineEventHandler(async (event) => {
  const id = idDaRota(event)
  const corpo = (await readBody(event)) ?? {}
  if (!Array.isArray(corpo.decisoes)) erro(400, 'decisoes deve ser uma lista')
  const decisoes: DecisaoLinha[] = (corpo.decisoes as Record<string, unknown>[]).map((d) => ({
    ordem: inteiro(d?.ordem, 'ordem', { obrigatorio: true, min: 1 })!,
    compraItemId: inteiro(d?.compraItemId, 'compraItemId', { min: 1 }) ?? undefined,
    itemId: inteiro(d?.itemId, 'itemId', { min: 1 }) ?? undefined,
    nome: texto(d?.nome, 'nome', { max: 80 }) ?? undefined,
    categoriaId: inteiro(d?.categoriaId, 'categoria', { min: 1 }) ?? undefined,
    ignorar: d?.ignorar === true,
  }))
  for (const d of decisoes) {
    if (!d.ignorar && !d.compraItemId && !d.itemId && !d.nome) erro(400, `Escolha o item da linha ${d.ordem}`)
  }
  const remover = Array.isArray(corpo.remover) && corpo.remover.length ? listaDeIds(corpo.remover, 'remover') : []
  const sql = await useDb()
  await compraEditavel(sql, id)
  await confirmarConferencia(sql, id, decisoes, remover)
  log('info', 'nfce conferida', { compra_id: id, linhas: decisoes.length, removidos: remover.length })
  return conferencia(sql, id)
})
