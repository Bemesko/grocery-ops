// Contrato da API com o front: o formato de cada resposta que as páginas de app/ usam,
// espelhando shared/types/api.ts. Só os testes de integração usam estes schemas (zod é
// devDependency): eles confirmam que cada rota devolve o que o front espera. Nada aqui
// roda em produção.
import { z } from 'zod'

const centavos = z.number().int()
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const instante = z.union([z.string().datetime({ offset: true }), z.string().datetime()])
const unidade = z.enum(['un', 'kg'])

export const embalagem = z.object({ qtd: z.number().positive(), unidade: z.enum(['g', 'kg', 'ml', 'l', 'un']) }).strict()

export const baseBudget = z
  .object({
    configurado: z.boolean(),
    saldo: centavos,
    gastoPeriodo: centavos,
    saldoInicioPeriodo: centavos,
    semana: dia,
    inicio: dia,
    fim: dia,
    diaPreferido: dia,
    fimCiclo: dia,
    semanasRestantes: z.number().int().nonnegative(),
  })
  .strict()

export const mercado = z.object({ id: z.number().int(), nome: z.string() }).strict()

export const listaItem = z
  .object({
    id: z.number().int(),
    itemId: z.number().int(),
    nome: z.string(),
    categoriaId: z.number().int(),
    unidade,
    quantidade: z.string().nullable(),
    variante: z.string().nullable(),
    prioritario: z.boolean(),
    nestaIda: z.boolean(),
    criadoEm: instante,
    origem: z.enum(['app', 'alexa']),
    estimativas: z.record(z.string(), centavos),
    porConteudo: z.array(z.number().int()),
  })
  .strict()

export const respostaLista = z
  .object({
    itens: z.array(listaItem),
    mercados: z.array(mercado),
    budget: baseBudget,
    compraAtual: z.object({ id: z.number().int(), mercadoId: z.number().int(), mercado: z.string() }).strict().nullable(),
  })
  .strict()

const variacao = z
  .object({
    anterior: centavos,
    percentual: z.number(),
    outroMercado: z.string().nullable(),
    porConteudo: z.string().nullable(),
    reduflacao: z.object({ de: embalagem, para: embalagem, percentual: z.number() }).strict().nullable(),
  })
  .strict()

export const compraItem = z
  .object({
    id: z.number().int(),
    itemId: z.number().int(),
    nome: z.string(),
    categoriaId: z.number().int(),
    unidade,
    quantidade: z.number().positive(),
    precoUnitario: centavos,
    precoCheio: centavos.nullable(),
    variante: z.string().nullable(),
    embalagem: embalagem.nullable(),
    daLista: z.boolean().nullable(),
    total: centavos,
    precoPendente: z.boolean(),
    unidades: z.number().int().positive().nullable(),
    variacao: variacao.nullable(),
  })
  .strict()

export const compra = z
  .object({
    id: z.number().int(),
    mercadoId: z.number().int(),
    mercado: z.string(),
    status: z.enum(['em_andamento', 'finalizada', 'cancelada']),
    data: dia,
    origem: z.enum(['app', 'importacao', 'nfce']),
    totalNota: centavos.nullable(),
    total: centavos,
    totalItens: centavos,
  })
  .strict()

export const respostaCompraAtual = z
  .object({
    compra: compra.nullable(),
    itens: z.array(compraItem),
    pendentes: z.array(
      z
        .object({
          listaItemId: z.number().int(),
          itemId: z.number().int(),
          nome: z.string(),
          categoriaId: z.number().int(),
          unidade,
          quantidade: z.string().nullable(),
          variante: z.string().nullable(),
          prioritario: z.boolean(),
          nestaIda: z.boolean(),
          estimativa: centavos.nullable(),
          estimativaOutroMercado: z.boolean(),
        })
        .strict(),
    ),
    budget: baseBudget,
  })
  .strict()

export const resumoCompra = z
  .object({
    compra,
    itens: z.array(compraItem),
    budget: baseBudget.nullable(),
    topItens: z.array(compraItem),
    foraDaLista: z.object({ quantidade: z.number().int(), total: centavos }).strict(),
    altas: z.array(compraItem),
    baixas: z.array(compraItem),
    divergencia: z.number().nullable(),
  })
  .strict()

export const conferenciaNota = z
  .object({
    estado: z.enum(['sem_nota', 'pendente', 'lida', 'conferida']),
    url: z.string().url().nullable(),
    chave: z.string().regex(/^\d{44}$/).nullable(),
    emitente: z.string().nullable(),
    emitidaEm: z.string().nullable(),
    total: centavos.nullable(),
    desconto: centavos.nullable(),
    aPagar: centavos.nullable(),
    descontoSemItem: centavos,
    linhas: z.array(
      z
        .object({
          ordem: z.number().int(),
          codigo: z.string().nullable(),
          descricao: z.string(),
          quantidade: z.number().positive(),
          unidade: z.string(),
          unitario: centavos,
          total: centavos,
          descontoNota: centavos.nullable(),
          desconto: centavos,
          pago: centavos,
          ean: z.string().nullable(),
          embalagem: embalagem.nullable(),
          nomeSugerido: z.string(),
          compraItemId: z.number().int().nullable(),
          nivel: z.enum(['confirmado', 'certo', 'sugerido']).nullable(),
        })
        .strict(),
    ),
    anotadosSemPar: z.array(z.number().int()),
  })
  .strict()

export const respostaLeituraNota = z
  .object({
    resultado: z.enum(['ok', 'verificacao', 'limite', 'erro']),
    mensagem: z.string().nullable(),
    conferencia: conferenciaNota,
  })
  .strict()

const gastoItem = z
  .object({
    itemId: z.number().int(),
    nome: z.string(),
    total: centavos,
    quantidade: z.number(),
    unidade,
    conteudo: z.object({ qtd: z.number(), base: z.enum(['kg', 'l']) }).strict().nullable(),
  })
  .strict()

export const semanaEvolucao = z
  .object({
    segunda: dia,
    inicio: dia,
    fim: dia,
    diaPreferido: dia,
    atrasada: z.boolean().optional(),
    budget: centavos.nullable(),
    gasto: centavos,
    situacao: z.enum(['passada', 'atual', 'futura']),
  })
  .strict()

export const gastos = z
  .object({
    tipo: z.enum(['mes', 'trimestre', 'semestre', 'ano']),
    periodo: z.string(),
    inicio: dia,
    fim: dia,
    meses: z.array(z.string().regex(/^\d{4}-\d{2}$/)),
    total: centavos,
    compras: z.number().int(),
    porMes: z.array(z.object({ mes: z.string(), total: centavos }).strict()),
    porCategoria: z.array(
      z.object({ categoriaId: z.number().int(), categoria: z.string(), total: centavos, itens: z.array(gastoItem) }).strict(),
    ),
    porMercado: z.array(z.object({ mercado: z.string(), total: centavos }).strict()),
    topItens: z.array(gastoItem),
    foraDaLista: z.object({ total: centavos, conhecido: centavos }).strict(),
    semanas: z.array(semanaEvolucao).nullable(),
    saldo: centavos.nullable(),
    projecao: z.boolean(),
  })
  .strict()

export const saldo = z
  .object({
    budget: baseBudget,
    ajustes: z.array(z.object({ id: z.number().int(), em: instante, saldo: centavos }).strict()),
  })
  .strict()

export const estadoAlexa = z
  .object({ ligada: z.boolean(), ultimaEm: z.string().nullable(), importados: z.number().int(), erro: z.string().nullable() })
  .strict()
