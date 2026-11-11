// Casamento das linhas da NFC-e com os itens anotados na compra (docs/produto-v1.md,
// "Nota fiscal (NFC-e)"). As descrições da nota são abreviadas e em maiúsculas
// ("AGUA MINERAL ... 500ML S GAS PET"); o app compara palavra a palavra com o nome e a
// variante anotados, usa a embalagem e o preço como desempate e lembra os pares confirmados
// pelo código do produto na loja.
import { similaridade } from './busca.ts'
import { lerEmbalagem, mesmoConteudo, type Embalagem } from './embalagem.ts'
import { pagoNaLinha, type LinhaNotaLida } from './notaFiscal.ts'
import { limparNome, normalizarNome } from './texto.ts'

export interface ItemAnotado {
  /** Id da linha da compra (compra_item). */
  id: number
  itemId: number
  nome: string
  variante: string | null
  quantidade: number
  precoUnitario: number
  embalagem: Embalagem | null
}

export interface ParNota {
  ordem: number
  compraItemId: number
  /** certo: código já confirmado ou nome bem parecido; sugerido: pede confirmação. */
  nivel: 'certo' | 'sugerido'
  pontos: number
}

export interface Casamento {
  pares: ParNota[]
  linhasSemPar: number[]
  anotadosSemPar: number[]
}

export const LIMIAR_CERTO = 0.75
export const LIMIAR_SUGERIDO = 0.45

// Abreviações comuns nas notas. Prefixos ("INTEG" → integral) já casam sozinhos.
const FRASES: [RegExp, string][] = [
  [/\bs\s*\/?\s*gas\b/g, 'sem gas'],
  [/\bc\s*\/?\s*gas\b/g, 'com gas'],
  [/\bs\s*\/\s*lact\w*/g, 'sem lactose'],
  [/\bzero lact\w*/g, 'sem lactose'],
  [/\bs\s*\/\s*acuc\w*/g, 'sem acucar'],
]
const PALAVRAS: Record<string, string> = {
  int: 'integral',
  desn: 'desnatado',
  semid: 'semidesnatado',
  refri: 'refrigerante',
  refrig: 'refrigerante',
  pct: 'pacote',
  pc: 'pacote',
  bdj: 'bandeja',
  cx: 'caixa',
  frgo: 'frango',
  frg: 'frango',
  qjo: 'queijo',
  qj: 'queijo',
  mus: 'mussarela',
  muss: 'mussarela',
  mucarela: 'mussarela',
  pres: 'presunto',
  lte: 'leite',
  bisc: 'biscoito',
  choc: 'chocolate',
  mac: 'macarrao',
  sab: 'sabonete',
  det: 'detergente',
  amac: 'amaciante',
  pap: 'papel',
  hig: 'higienico',
  ext: 'extrato',
  req: 'requeijao',
  marg: 'margarina',
  iog: 'iogurte',
  cerv: 'cerveja',
  trad: 'tradicional',
  tom: 'tomate',
  fj: 'feijao',
  arr: 'arroz',
}
// Palavras que não ajudam a identificar o produto.
const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'e', 'pet', 'un', 'und', 'kg', 'g', 'ml', 'l', 'lt', 'emb', 'tp'])
const EMBALAGEM = /(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|grs|ml|l|lt|lts|un|und|unid)\b/i

/** Descrição da nota → palavras normalizadas, com as abreviações expandidas. */
export function palavrasDaDescricao(descricao: string): string[] {
  let s = normalizarNome(descricao).replace(/[.,;:()]/g, ' ')
  for (const [re, troca] of FRASES) s = s.replace(re, troca)
  return s
    .split(/[\s/-]+/)
    .map((p) => PALAVRAS[p] ?? p)
    .filter((p) => p && !VAZIAS.has(p) && !EMBALAGEM.test(p) && !/^\d+$/.test(p))
}

function palavrasDoNome(texto: string | null): string[] {
  return texto
    ? normalizarNome(texto)
        .split(/[\s/-]+/)
        .filter((p) => p && !VAZIAS.has(p))
    : []
}

/** "AGUA ... 500ML S GAS" → 500 ml. */
export function embalagemDaDescricao(descricao: string): Embalagem | null {
  const m = EMBALAGEM.exec(descricao)
  return m ? lerEmbalagem(`${m[1]} ${m[2]}`) : null
}

/** Nome sugerido para criar um item a partir da linha da nota. */
export function nomeDaDescricao(descricao: string): string {
  return limparNome(palavrasDaDescricao(descricao).slice(0, 4).join(' '))
}

/** Quanto uma palavra do nome anotado aparece na descrição (0..1). */
function presenca(palavra: string, descricao: string[]): number {
  let melhor = 0
  for (const d of descricao) {
    if (d === palavra) return 1
    // Abreviação: a palavra da nota é o começo da anotada ("integ" → "integral").
    if (d.length >= 3 && palavra.startsWith(d)) melhor = Math.max(melhor, 0.9)
    else if (palavra.length >= 4 && d.startsWith(palavra)) melhor = Math.max(melhor, 0.85)
    else if (palavra.length >= 4) melhor = Math.max(melhor, similaridade(palavra, d) >= 0.75 ? similaridade(palavra, d) : 0)
  }
  return melhor
}

/** Pontuação (0..~1,3) de uma linha da nota contra um item anotado. */
export function pontuar(linha: LinhaNotaLida, anotado: ItemAnotado): number {
  const descricao = palavrasDaDescricao(linha.descricao)
  const nome = palavrasDoNome(anotado.nome)
  if (!nome.length) return 0
  const doNome = nome.reduce((s, p) => s + presenca(p, descricao), 0) / nome.length
  const variante = palavrasDoNome(anotado.variante)
  const daVariante = variante.length ? variante.reduce((s, p) => s + presenca(p, descricao), 0) / variante.length : 0
  let pontos = doNome * 0.7 + daVariante * 0.1
  const embalagem = embalagemDaDescricao(linha.descricao)
  if (embalagem && anotado.embalagem) pontos += mesmoConteudo(embalagem, anotado.embalagem) ? 0.1 : -0.1
  // A pessoa anota o preço pago (com desconto): compara com o unitário pago da nota.
  const pago = Math.round(pagoNaLinha(linha) / linha.quantidade)
  const diferenca = Math.abs(pago - anotado.precoUnitario) / Math.max(1, pago, anotado.precoUnitario)
  if (diferenca <= 0.02) pontos += 0.2
  else if (diferenca <= 0.2) pontos += 0.1
  if (Math.abs(linha.quantidade - anotado.quantidade) < 0.001) pontos += 0.05
  return Math.round(pontos * 1000) / 1000
}

/**
 * Pares linha da nota × item anotado. Um código de produto já confirmado neste mercado
 * casa direto; o resto vai pela maior pontuação, um item para cada linha.
 */
export function casarNota(linhas: LinhaNotaLida[], anotados: ItemAnotado[], codigos: Map<string, number>): Casamento {
  const pares: ParNota[] = []
  const linhasLivres = new Set(linhas.map((l) => l.ordem))
  const anotadosLivres = new Set(anotados.map((a) => a.id))

  for (const linha of linhas) {
    const itemId = linha.codigo ? codigos.get(linha.codigo) : undefined
    if (itemId === undefined) continue
    const anotado = anotados.find((a) => a.itemId === itemId && anotadosLivres.has(a.id))
    if (!anotado) continue
    pares.push({ ordem: linha.ordem, compraItemId: anotado.id, nivel: 'certo', pontos: 2 })
    linhasLivres.delete(linha.ordem)
    anotadosLivres.delete(anotado.id)
  }

  const candidatos: { linha: LinhaNotaLida; anotado: ItemAnotado; pontos: number }[] = []
  for (const linha of linhas) {
    if (!linhasLivres.has(linha.ordem)) continue
    for (const anotado of anotados) {
      if (!anotadosLivres.has(anotado.id)) continue
      const pontos = pontuar(linha, anotado)
      if (pontos >= LIMIAR_SUGERIDO) candidatos.push({ linha, anotado, pontos })
    }
  }
  candidatos.sort((a, b) => b.pontos - a.pontos || a.linha.ordem - b.linha.ordem)
  for (const c of candidatos) {
    if (!linhasLivres.has(c.linha.ordem) || !anotadosLivres.has(c.anotado.id)) continue
    pares.push({
      ordem: c.linha.ordem,
      compraItemId: c.anotado.id,
      nivel: c.pontos >= LIMIAR_CERTO ? 'certo' : 'sugerido',
      pontos: c.pontos,
    })
    linhasLivres.delete(c.linha.ordem)
    anotadosLivres.delete(c.anotado.id)
  }

  return {
    pares: pares.sort((a, b) => a.ordem - b.ordem),
    linhasSemPar: [...linhasLivres].sort((a, b) => a - b),
    anotadosSemPar: [...anotadosLivres],
  }
}

/** Unidade do app para a unidade comercial da nota. */
export function unidadeDaNota(unidade: string): 'un' | 'kg' {
  return /^kg/i.test(unidade.trim()) ? 'kg' : 'un'
}

/**
 * Preço da linha depois da conferência, pelo que a nota cobrou: pago = valor − desconto
 * (exato, vai para o total da linha); preço = pago ÷ quantidade; preço cheio = unitário da
 * nota quando houve desconto. Sem desconto, um preço cheio anotado maior que o da nota fica
 * (uma promoção que a nota não mostra como desconto).
 */
export function precoConferido(
  linha: { unitario: number; total: number; desconto: number | null; quantidade: number },
  precoCheioAnotado: number | null = null,
): { preco: number; precoCheio: number | null; total: number } {
  const total = pagoNaLinha(linha)
  const preco = Math.round(total / linha.quantidade)
  if ((linha.desconto ?? 0) > 0) return { preco, precoCheio: linha.unitario, total }
  return { preco, precoCheio: precoCheioAnotado && precoCheioAnotado > preco ? precoCheioAnotado : null, total }
}
