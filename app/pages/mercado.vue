<template>
  <main class="pagina">
    <template v-if="carregado && !compra">
      <header class="cabecalho"><h1>Mercado</h1></header>
      <p class="vazio">
        Nenhuma compra em andamento.<br />
        <NuxtLink to="/">Prepare a ida na lista</NuxtLink> ou comece agora:
      </p>
      <div class="chips centro">
        <button v-for="m in mercados" :key="m.id" type="button" class="primario" @click="comecar(m.id)">
          {{ m.nome }}
        </button>
      </div>
      <p v-if="!mercados.length" class="vazio"><NuxtLink to="/ajustes#mercados">Cadastre os mercados</NuxtLink></p>
    </template>

    <template v-else-if="compra && dados">
      <header class="painel cartao">
        <div class="linha">
          <h1 class="cresce">{{ compra.mercado }}</h1>
          <strong class="num total">{{ formatarDinheiro(totalCarrinho) }}</strong>
        </div>
        <div class="linha suave">
          <span class="cresce">
            {{ dados.itens.length }} no carrinho
            <template v-if="faltam.itens && faltam.total"> · faltam ≈ {{ formatarDinheiro(faltam.total) }} ({{ faltam.itens }})</template>
            <template v-else-if="faltam.itens"> · faltam {{ faltam.itens }} sem preço conhecido</template>
          </span>
          <span v-if="projecao" class="num" :class="corRestante">
            {{ projecao.restante >= 0 ? 'resta' : 'passou' }} {{ formatarDinheiro(Math.abs(projecao.restante)) }}
          </span>
        </div>
        <div v-if="projecao" class="barra" :title="`Budget do período: ${formatarDinheiro(projecao.budget)}`">
          <span :style="{ width: `${Math.min(100, (projecao.usado / Math.max(1, projecao.budget)) * 100)}%` }" :class="corRestante" />
        </div>
        <p v-if="projecao?.faltaSaldo" class="aviso perigo">
          O carrinho passa do saldo do VR ({{ formatarDinheiro(dados.budget.saldo) }}).
        </p>
        <p v-else-if="projecao?.excedeu && projecao.proximasSemanas !== null" class="aviso alerta">
          Se fechar assim: próximas {{ semanasTexto(projecao.semanasDepois) }} com
          <strong class="num">{{ formatarDinheiro(projecao.proximasSemanas) }}</strong>
          (era {{ formatarDinheiro(projecao.semanalNormal) }})
        </p>
        <p v-else-if="projecao?.excedeu" class="aviso alerta">
          Último período do mês: sobram {{ formatarDinheiro(projecao.saldoApos) }} de saldo para o próximo ciclo.
        </p>
        <p v-else-if="previsao?.excedeu && previsao.proximasSemanas !== null" class="aviso info">
          Pela estimativa, a lista toda passa do budget: próximas semanas ficariam com
          {{ formatarDinheiro(previsao.proximasSemanas) }}.
        </p>
        <p v-if="!dados.budget.configurado" class="suave">
          <NuxtLink to="/ajustes#saldo">Informe o saldo do VR</NuxtLink> para acompanhar o budget.
        </p>
      </header>

      <section v-for="grupo in grupos" :key="grupo.categoria.id">
        <h3>{{ grupo.categoria.nome }}</h3>
        <ul class="lista">
          <li
            v-for="p in grupo.pendentes"
            :key="`p${p.listaItemId}`"
            class="pendente"
            :class="{ prioritario: p.prioritario }"
            @click="abrirPendente(p)"
          >
            <span class="caixa" aria-hidden="true" />
            <span class="cresce">
              <MarcaPrioridade v-if="p.prioritario" ligada pequena />
              {{ p.nome }}
              <span v-if="p.quantidade" class="suave">· {{ p.quantidade }}</span>
            </span>
            <span v-if="p.estimativa !== null" class="suave num" :title="p.estimativaOutroMercado ? 'preço de outro mercado' : ''">
              ≈ {{ formatarDinheiro(p.estimativa) }}{{ p.estimativaOutroMercado ? '*' : '' }}
            </span>
          </li>
          <li v-for="c in grupo.carrinho" :key="`c${c.id}`" class="pego" @click="abrirLinha(c)">
            <span class="caixa marcada" aria-hidden="true">✓</span>
            <span class="cresce">
              {{ c.nome }}
              <span class="suave">
                · {{ formatarQuantidade(c.quantidade, c.unidade) }}<template v-if="c.embalagem"> de {{ formatarEmbalagem(c.embalagem) }}</template>
                <template v-if="c.variante"> · {{ c.variante }}</template>
              </span>
              <span v-if="c.daLista === false" class="selo neutro">fora da lista</span>
              <SeloVariacao :variacao="c.variacao" class="selos-linha" />
            </span>
            <span class="num">{{ formatarDinheiro(c.total) }}</span>
          </li>
        </ul>
      </section>

      <section v-if="outrosDaLista.length">
        <button type="button" class="texto mostrar" @click="mostrarOutros = !mostrarOutros">
          {{ mostrarOutros ? '▾' : '▸' }} Também na lista ({{ outrosDaLista.length }})
        </button>
        <ul v-if="mostrarOutros" class="lista">
          <li v-for="p in outrosDaLista" :key="p.listaItemId" class="pendente" @click="abrirPendente(p)">
            <span class="caixa" aria-hidden="true" />
            <span class="cresce">{{ p.nome }}</span>
            <span v-if="p.estimativa !== null" class="suave num">≈ {{ formatarDinheiro(p.estimativa) }}</span>
          </li>
        </ul>
      </section>

      <p v-if="!grupos.length && !outrosDaLista.length" class="vazio">Carrinho vazio. Toque em + para registrar.</p>

      <div class="fim">
        <button type="button" class="primario" :disabled="!dados.itens.length" @click="fechando = true">
          Finalizar compra
        </button>
        <button type="button" class="texto perigo-texto" @click="cancelar">Cancelar compra</button>
      </div>

      <button type="button" class="mais primario" aria-label="Item fora da lista" @click="adicionandoNovo = true">+</button>
    </template>

    <!-- item fora da lista: primeiro o nome -->
    <div v-if="adicionandoNovo" class="fundo" @click.self="adicionandoNovo = false">
      <div class="folha-nome">
        <div class="cabecalho">
          <h2>O que entrou no carrinho?</h2>
          <button type="button" class="icone" aria-label="Fechar" @click="adicionandoNovo = false">✕</button>
        </div>
        <BuscaItem :itens="itens" autofocus placeholder="Nome do item" @escolher="escolherExistente" @novo="escolherNovo" />
        <div class="espaco" />
      </div>
    </div>

    <FolhaPreco
      v-if="folha"
      :key="folha.chave"
      :titulo="folha.titulo"
      :unidade="folha.unidade"
      :quantidade="folha.quantidade"
      :referencia="folha.referencia"
      :inicial="folha.inicial"
      :precisa-categoria="folha.precisaCategoria"
      :embalagem-habitual="folha.embalagemHabitual"
      @fechar="folha = null"
      @salvar="salvarLinha"
      @remover="removerLinha"
    />

    <div v-if="fechando" class="fundo" @click.self="fechando = false">
      <form class="folha-nome" @submit.prevent="finalizar">
        <h2>Finalizar compra</h2>
        <p>
          Total no app: <strong class="num">{{ formatarDinheiro(totalCarrinho) }}</strong>
        </p>
        <label for="nota">Total da nota (opcional, para conferir)</label>
        <input id="nota" v-model="totalNotaTexto" inputmode="decimal" placeholder="0,00" />
        <p v-if="divergenciaPrevia !== null" class="suave">
          Diferença: {{ formatarPercentual(divergenciaPrevia, 1) }}
          <span :class="Math.abs(divergenciaPrevia) <= 0.05 ? 'ok' : 'ruim'">
            {{ Math.abs(divergenciaPrevia) <= 0.05 ? '(dentro dos 5%)' : '(confira os itens)' }}
          </span>
        </p>
        <div class="linha acoes">
          <button type="button" @click="fechando = false">Voltar</button>
          <button type="submit" class="primario">Finalizar</button>
        </div>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import type {
  CompraItem,
  DadosLinha,
  ItemResumo,
  Mercado,
  PendenteMercado,
  PrecoReferencia,
  RespostaCompraAtual,
  Unidade,
} from '../../shared/types/api'
import type { Embalagem } from '../../shared/utils/embalagem'

interface Folha {
  chave: string
  titulo: string
  unidade: Unidade
  quantidade: number | null
  referencia: PrecoReferencia | null
  inicial: Omit<DadosLinha, 'categoriaId'> | null
  precisaCategoria: boolean
  embalagemHabitual: Embalagem | null
  /** Para onde salvar: item existente, nome novo ou linha já no carrinho. */
  itemId?: number
  nome?: string
  linhaId?: number
}

const dados = ref<RespostaCompraAtual | null>(null)
const mercados = ref<Mercado[]>([])
const carregado = ref(false)
const folha = ref<Folha | null>(null)
const adicionandoNovo = ref(false)
const mostrarOutros = ref(false)
const fechando = ref(false)
const totalNotaTexto = ref('')
const { itens, recarregar: recarregarItens } = useItens()
const { categorias, recarregar: recarregarCategorias } = useCategorias()

async function carregar() {
  const r = await tentar(() => $fetch<RespostaCompraAtual>('/api/compras/atual'))
  if (!r) return
  dados.value = r
  carregado.value = true
}

onMounted(async () => {
  await carregar()
  recarregarItens().catch(() => {})
  recarregarCategorias().catch(() => {})
  if (!dados.value?.compra) mercados.value = (await tentar(() => $fetch<Mercado[]>('/api/mercados'))) ?? []
})
useAtualizacaoPeriodica(() => {
  if (!folha.value && !fechando.value && !adicionandoNovo.value) carregar()
}, 10000)

const compra = computed(() => dados.value?.compra ?? null)
const totalCarrinho = computed(() => dados.value?.itens.reduce((s, i) => s + i.total, 0) ?? 0)
const nestaIda = computed(() => dados.value?.pendentes.filter((p) => p.nestaIda) ?? [])
const outrosDaLista = computed(() => dados.value?.pendentes.filter((p) => !p.nestaIda) ?? [])
const faltam = computed(() => {
  const comEstimativa = nestaIda.value.filter((p) => p.estimativa !== null)
  return { itens: nestaIda.value.length, total: comEstimativa.reduce((s, p) => s + p.estimativa!, 0) }
})

const projecao = computed(() =>
  dados.value?.budget.configurado ? projetarBudget(dados.value.budget, totalCarrinho.value) : null,
)
const previsao = computed(() =>
  dados.value?.budget.configurado && faltam.value.total
    ? projetarBudget(dados.value.budget, totalCarrinho.value + faltam.value.total)
    : null,
)
const corRestante = computed(() => {
  if (!projecao.value) return ''
  if (projecao.value.restante < 0) return 'ruim'
  return projecao.value.restante < projecao.value.budget * 0.2 ? 'atencao' : 'ok'
})

const grupos = computed(() =>
  categorias.value
    .map((categoria) => ({
      categoria,
      pendentes: nestaIda.value.filter((p) => p.categoriaId === categoria.id),
      carrinho: (dados.value?.itens ?? []).filter((c) => c.categoriaId === categoria.id),
    }))
    .filter((g) => g.pendentes.length || g.carrinho.length),
)

function semanasTexto(semanas: number) {
  const n = Math.ceil(semanas - 0.01)
  return n <= 1 ? 'semana' : `${n} semanas`
}

function referenciaDe(itemId: number): PrecoReferencia | null {
  if (!compra.value) return null
  return itens.value.find((i) => i.id === itemId)?.precos[compra.value.mercadoId] ?? null
}

function abrirPendente(p: PendenteMercado) {
  const item = itens.value.find((i) => i.id === p.itemId)
  const ref = referenciaDe(p.itemId)
  folha.value = {
    chave: `p${p.listaItemId}`,
    titulo: p.nome,
    unidade: p.unidade,
    quantidade: quantidadeDoTexto(p.quantidade) ?? ref?.quantidade ?? item?.ultimaQuantidade ?? null,
    referencia: ref,
    inicial: null,
    precisaCategoria: false,
    embalagemHabitual: item?.embalagem ?? null,
    itemId: p.itemId,
  }
}

function abrirLinha(c: CompraItem) {
  folha.value = {
    chave: `c${c.id}`,
    titulo: c.nome,
    unidade: c.unidade,
    quantidade: c.quantidade,
    // A compra em andamento não está finalizada: o último preço do item aqui é o da compra anterior.
    referencia: referenciaDe(c.itemId),
    inicial: {
      unidade: c.unidade,
      quantidade: c.quantidade,
      precoUnitario: c.precoUnitario,
      precoCheio: c.precoCheio,
      variante: c.variante,
      embalagem: c.embalagem,
    },
    embalagemHabitual: itens.value.find((i) => i.id === c.itemId)?.embalagem ?? null,
    precisaCategoria: false,
    linhaId: c.id,
  }
}

function escolherExistente(item: ItemResumo) {
  adicionandoNovo.value = false
  const ref = referenciaDe(item.id)
  folha.value = {
    chave: `i${item.id}`,
    titulo: item.nome,
    unidade: item.unidade,
    quantidade: ref?.quantidade ?? item.ultimaQuantidade,
    referencia: ref,
    inicial: null,
    precisaCategoria: false,
    embalagemHabitual: item.embalagem,
    itemId: item.id,
  }
}

function escolherNovo(nome: string) {
  adicionandoNovo.value = false
  folha.value = {
    chave: `n${nome}`,
    titulo: nome,
    unidade: 'un',
    quantidade: 1,
    referencia: null,
    inicial: null,
    precisaCategoria: true,
    embalagemHabitual: null,
    nome,
  }
}

async function salvarLinha(d: DadosLinha) {
  const f = folha.value
  if (!f || !compra.value) return
  const corpo = {
    unidade: d.unidade,
    quantidade: d.quantidade,
    precoUnitario: d.precoUnitario,
    precoCheio: d.precoCheio,
    variante: d.variante,
    embalagem: d.embalagem,
  }
  const base = `/api/compras/${compra.value.id}/itens`
  const ok = f.linhaId
    ? await tentar(() => $fetch(`${base}/${f.linhaId}`, { method: 'PATCH', body: corpo }))
    : await tentar(() =>
        $fetch(base, { method: 'POST', body: { ...corpo, itemId: f.itemId, nome: f.nome, categoriaId: d.categoriaId } }),
      )
  if (!ok) return
  folha.value = null
  await Promise.all([carregar(), f.nome ? recarregarItens() : null])
}

async function removerLinha() {
  const f = folha.value
  if (!f?.linhaId || !compra.value) return
  const id = compra.value.id
  await tentar(() => $fetch(`/api/compras/${id}/itens/${f.linhaId}`, { method: 'DELETE' }))
  folha.value = null
  await carregar()
}

const divergenciaPrevia = computed(() => {
  const nota = parseDinheiro(totalNotaTexto.value)
  return nota ? (totalCarrinho.value - nota) / nota : null
})

async function finalizar() {
  if (!compra.value) return
  const id = compra.value.id
  const totalNota = parseDinheiro(totalNotaTexto.value)
  const ok = await tentar(() => $fetch(`/api/compras/${id}/finalizar`, { method: 'POST', body: { totalNota } }))
  if (!ok) return
  fechando.value = false
  await recarregarItens().catch(() => {})
  await navigateTo(`/compras/${id}?nova=1`)
}

async function cancelar() {
  if (!compra.value || !confirm('Cancelar esta compra? Os itens registrados nela serão descartados.')) return
  const id = compra.value.id
  await tentar(() => $fetch(`/api/compras/${id}/cancelar`, { method: 'POST' }))
  await navigateTo('/')
}

async function comecar(mercadoId: number) {
  const ok = await tentar(() => $fetch('/api/compras', { method: 'POST', body: { mercadoId, levarTudo: false } }))
  if (ok) await carregar()
}
</script>

<style scoped>
.painel {
  position: sticky;
  top: 0.5rem;
  z-index: 10;
  display: grid;
  gap: 0.35rem;
}

.painel h1 {
  font-size: 1.15rem;
}

.painel .aviso {
  margin: 0.25rem 0 0;
}

.total {
  font-size: 1.4rem;
}

.barra > span.atencao {
  background: var(--alerta);
}

.barra > span.ruim {
  background: var(--perigo);
}

.cresce {
  flex: 1;
  min-width: 0;
}

.lista li {
  cursor: pointer;
}

.caixa {
  width: 1.4rem;
  height: 1.4rem;
  flex: none;
  border: 2px solid var(--borda);
  border-radius: 0.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
}

.caixa.marcada {
  background: var(--primaria);
  border-color: var(--primaria);
  color: #fff;
}

.pego .cresce {
  color: var(--texto-suave);
}

.selos-linha {
  margin-top: 0.2rem;
}

.mostrar {
  margin-top: 1rem;
}

.fim {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.perigo-texto {
  color: var(--perigo);
}

.mais {
  position: fixed;
  right: 1rem;
  bottom: 4.75rem;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  font-size: 1.75rem;
  box-shadow: var(--sombra);
  z-index: 15;
}

.centro {
  justify-content: center;
}

.fundo {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 35%);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 40;
}

.folha-nome {
  background: var(--superficie);
  width: 100%;
  max-width: 40rem;
  border-radius: 1rem 1rem 0 0;
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
}

.folha-nome h2 {
  margin-top: 0;
}

.espaco {
  height: 16rem;
}

.acoes {
  justify-content: flex-end;
  margin-top: 1rem;
}
</style>
