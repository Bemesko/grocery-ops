// Formatos das respostas da API (server/api), usados pelas páginas em app/.
import type { BaseBudget, SemanaEvolucao } from '../utils/budget'
import type { Embalagem, Reduflacao } from '../utils/embalagem'

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
  embalagem: Embalagem | null
}

export interface ItemResumo {
  id: number
  nome: string
  categoriaId: number
  unidade: Unidade
  usos: number
  /** Embalagem habitual (opcional): base das estimativas quando os mercados vendem tamanhos diferentes. */
  embalagem: Embalagem | null
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
  /** Preço anterior: da unidade/kg, ou por conteúdo quando `porConteudo`. */
  anterior: number
  percentual: number
  /** null = mesmo mercado; senão o nome do mercado comparado. */
  outroMercado: string | null
  /** '/kg', '/L' ou '/un' quando as embalagens diferem e a comparação é por conteúdo. */
  porConteudo: string | null
  /** A embalagem encolheu e o preço por conteúdo subiu. */
  reduflacao: Reduflacao | null
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
  embalagem: Embalagem | null
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
  /** Só para itens por unidade. */
  embalagem: Embalagem | null
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

export interface LinhaConferencia {
  ordem: number
  codigo: string | null
  descricao: string
  quantidade: number
  /** Unidade comercial da nota (UN, KG, PCT…). */
  unidade: string
  /** Preço cheio da unidade. */
  unitario: number
  /** Valor da linha antes do desconto. */
  total: number
  /** Desconto da linha; null = desconhecido (falta a página detalhada). */
  desconto: number | null
  /** Pago na linha: total − desconto. */
  pago: number
  ean: string | null
  embalagem: Embalagem | null
  /** Nome sugerido para criar um item a partir desta linha. */
  nomeSugerido: string
  /** Par da linha: confirmado (gravado), certo ou sugerido (calculados), ou nenhum. */
  compraItemId: number | null
  nivel: 'confirmado' | 'certo' | 'sugerido' | null
}

/** Nota fiscal de uma compra e o casamento das linhas com os itens anotados. */
export interface ConferenciaNota {
  /** sem_nota: nada lido; pendente: o link está guardado, mas a nota não pôde ser lida. */
  estado: 'sem_nota' | 'pendente' | 'lida' | 'conferida'
  url: string | null
  chave: string | null
  emitente: string | null
  emitidaEm: string | null
  total: number | null
  desconto: number | null
  aPagar: number | null
  /** Alguma linha sem o desconto: a confirmação espera a página detalhada. */
  precisaDetalhada: boolean
  linhas: LinhaConferencia[]
  /** Itens anotados (compra_item) sem par na nota. */
  anotadosSemPar: number[]
}

export type ResultadoLeitura = 'ok' | 'verificacao' | 'simples' | 'limite' | 'erro'

export interface RespostaLeituraNota {
  resultado: ResultadoLeitura
  mensagem: string | null
  conferencia: ConferenciaNota
}

/** Uma decisão da conferência para uma linha da nota. */
export interface DecisaoLinha {
  ordem: number
  /** Par com um item anotado. */
  compraItemId?: number
  /** Linha que não foi anotada: entra na compra como este item (existente ou novo). */
  itemId?: number
  nome?: string
  categoriaId?: number
  /** Fica de fora da compra (ex.: sacola). */
  ignorar?: boolean
}

export interface GastoItem {
  itemId: number
  nome: string
  total: number
  quantidade: number
  unidade: Unidade
}

export interface Gastos {
  tipo: 'mes' | 'trimestre'
  /** AAAA-MM ou AAAA-Tn. */
  periodo: string
  inicio: string
  fim: string
  /** Meses com compras finalizadas (AAAA-MM), do mais recente ao mais antigo. */
  meses: string[]
  total: number
  compras: number
  /** Total de cada mês do período (no trimestre, os 3 meses). */
  porMes: { mes: string; total: number }[]
  /** Com todos os itens de cada categoria, para o drill-down. */
  porCategoria: { categoriaId: number; categoria: string; total: number; itens: GastoItem[] }[]
  porMercado: { mercado: string; total: number }[]
  topItens: GastoItem[]
  /** Só compras em que se sabe se o item estava na lista. */
  foraDaLista: { total: number; conhecido: number }
  /** Budget × gasto por semana (só no mês). */
  semanas: SemanaEvolucao[] | null
}
}

export interface Configuracao {
  /** 0 = segunda … 6 = domingo. */
  diaPreferido: number
}
