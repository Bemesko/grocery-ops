// Formatos das respostas da API (server/api), usados pelas páginas em app/.
import type { BaseBudget } from '../utils/budget'

export type Unidade = 'un' | 'kg'

export interface Categoria {
  id: number
  nome: string
  ordem: number
  itens?: number
}

export interface Mercado {
  id: number
  nome: string
  tipo: 'atacado' | 'varejo'
}

export interface PrecoReferencia {
  preco: number
  quantidade: number
  variante: string | null
  data: string
}

export interface ItemResumo {
  id: number
  nome: string
  categoriaId: number
  unidade: Unidade
  usos: number
  ultimaQuantidade: number | null
  /** Último preço por mercado (chave = id do mercado). */
  precos: Record<string, PrecoReferencia>
}

export interface ListaItem {
  id: number
  itemId: number
  nome: string
  categoriaId: number
  unidade: Unidade
  quantidade: string | null
  prioritario: boolean
  nestaIda: boolean
  criadoEm: string
  /** Estimativa por mercado (chave = id do mercado), em centavos. */
  estimativas: Record<string, number>
}

export interface RespostaLista {
  itens: ListaItem[]
  mercados: Mercado[]
  budget: BaseBudget
  compraAtual: { id: number; mercadoId: number; mercado: string } | null
}

export interface Variacao {
  anterior: number
  percentual: number
  /** null = mesmo mercado; senão o nome do mercado comparado. */
  outroMercado: string | null
}

export interface CompraItem {
  id: number
  itemId: number
  nome: string
  categoriaId: number
  unidade: Unidade
  quantidade: number
  precoUnitario: number
  precoCheio: number | null
  variante: string | null
  daLista: boolean | null
  total: number
  variacao: Variacao | null
}

/** O que a folha de preço envia ao registrar ou corrigir uma linha do carrinho. */
export interface DadosLinha {
  unidade: Unidade
  quantidade: number
  precoUnitario: number
  precoCheio: number | null
  variante: string | null
  categoriaId: number | null
}

export interface Compra {
  id: number
  mercadoId: number
  mercado: string
  status: 'em_andamento' | 'finalizada' | 'cancelada'
  data: string
  origem: 'app' | 'importacao' | 'nfce'
  totalNota: number | null
  total: number
}

export interface PendenteMercado {
  listaItemId: number
  itemId: number
  nome: string
  categoriaId: number
  unidade: Unidade
  quantidade: string | null
  prioritario: boolean
  nestaIda: boolean
  estimativa: number | null
  /** A estimativa veio de outro mercado. */
  estimativaOutroMercado: boolean
}

export interface RespostaCompraAtual {
  compra: Compra | null
  itens: CompraItem[]
  pendentes: PendenteMercado[]
  budget: BaseBudget
}

export interface ResumoCompra {
  compra: Compra
  itens: CompraItem[]
  budget: BaseBudget | null
  topItens: CompraItem[]
  foraDaLista: { quantidade: number; total: number }
  altas: CompraItem[]
  baixas: CompraItem[]
  /** (total do app − total da nota) / total da nota. */
  divergencia: number | null
}

export interface Gastos {
  mes: string
  meses: string[]
  total: number
  compras: number
  porCategoria: { categoria: string; total: number }[]
  porMercado: { mercado: string; total: number }[]
  topItens: { itemId: number; nome: string; total: number; quantidade: number; unidade: Unidade }[]
  /** Só compras em que se sabe se o item estava na lista. */
  foraDaLista: { total: number; conhecido: number }
}

export interface Configuracao {
  /** 0 = segunda … 6 = domingo. */
  diaPreferido: number
}
