import type { Categoria, ItemResumo } from '../../shared/types/api'

export interface Aviso {
  texto: string
  tipo: 'info' | 'erro'
}

export const useAviso = () => useState<Aviso | null>('aviso', () => null)

export function avisar(texto: string, tipo: Aviso['tipo'] = 'info') {
  const aviso = useAviso()
  aviso.value = { texto, tipo }
  setTimeout(() => {
    if (aviso.value?.texto === texto) aviso.value = null
  }, 3500)
}

export function mensagemErro(e: unknown): string {
  const dados = (e as { data?: { message?: string } })?.data
  return dados?.message ?? (e as Error)?.message ?? 'Algo deu errado'
}

/** Executa uma ação da API mostrando o erro num aviso. Devolve undefined se falhou. */
export async function tentar<T>(acao: () => Promise<T>): Promise<T | undefined> {
  try {
    return await acao()
  } catch (e) {
    avisar(mensagemErro(e), 'erro')
    return undefined
  }
}

/** Itens conhecidos (sugestões ao digitar e preços pré-preenchidos), compartilhados entre as telas. */
export function useItens() {
  const itens = useState<ItemResumo[]>('itens', () => [])
  const recarregar = async () => {
    itens.value = await $fetch<ItemResumo[]>('/api/itens')
  }
  return { itens, recarregar }
}

export function useCategorias() {
  const categorias = useState<Categoria[]>('categorias', () => [])
  const recarregar = async () => {
    categorias.value = await $fetch<Categoria[]>('/api/categorias')
  }
  const ordem = computed(() => new Map(categorias.value.map((c) => [c.id, c.ordem])))
  const nome = computed(() => new Map(categorias.value.map((c) => [c.id, c.nome])))
  return { categorias, recarregar, ordem, nome }
}

/** Agrupa por categoria, na ordem dos corredores. */
export function agruparPorCategoria<T extends { categoriaId: number }>(
  linhas: T[],
  categorias: Categoria[],
): { categoria: Categoria; linhas: T[] }[] {
  return categorias
    .map((categoria) => ({ categoria, linhas: linhas.filter((l) => l.categoriaId === categoria.id) }))
    .filter((g) => g.linhas.length)
}

/** Repete `acao` enquanto a tela está visível; também ao voltar para o app. */
export function useAtualizacaoPeriodica(acao: () => unknown, ms = 5000) {
  let timer: ReturnType<typeof setInterval> | undefined
  const aoMudarVisibilidade = () => {
    if (document.visibilityState === 'visible') acao()
  }
  onMounted(() => {
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') acao()
    }, ms)
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('focus', aoMudarVisibilidade)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    window.removeEventListener('focus', aoMudarVisibilidade)
  })
}
