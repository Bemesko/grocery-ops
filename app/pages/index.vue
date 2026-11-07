<template>
  <main class="pagina">
    <header class="cabecalho">
      <h1>Lista</h1>
      <NuxtLink v-if="projecao" to="/ajustes#saldo" class="budget num" :class="corRestante">
        Semana: {{ formatarDinheiro(projecao.restante) }}
      </NuxtLink>
      <NuxtLink v-else-if="dados && !dados.budget.configurado" to="/ajustes#saldo" class="suave">
        Informar saldo do VR
      </NuxtLink>
    </header>

    <NuxtLink v-if="dados?.compraAtual" to="/mercado" class="aviso info em-andamento">
      🛒 Compra em andamento no <strong>{{ dados.compraAtual.mercado }}</strong> → continuar
    </NuxtLink>

    <BuscaItem :itens="itens" @escolher="adicionarExistente" @novo="pedirCategoria" />

    <div v-if="novoNome" class="cartao novo">
      <p>
        Categoria de <strong>{{ novoNome }}</strong>:
      </p>
      <EscolhaCategoria :model-value="null" @update:model-value="adicionarNovo" />
      <button type="button" class="texto" @click="novoNome = ''">Cancelar</button>
    </div>

    <div class="modo">
      <template v-if="preparando">
        <button type="button" class="texto" @click="selecionar('prioritarios')">Só prioritários</button>
        <button type="button" class="texto" @click="selecionar('todos')">Todos</button>
        <button type="button" class="texto" @click="selecionar('nenhum')">Nenhum</button>
        <button type="button" class="fechar-modo" @click="preparando = false">Pronto</button>
      </template>
      <button v-else-if="lista.length && !dados?.compraAtual" type="button" @click="prepararIda">
        🧺 Preparar ida
      </button>
    </div>

    <p v-if="carregado && !lista.length" class="vazio">Lista vazia. Anote o que acabou durante a semana.</p>

    <section v-for="grupo in grupos" :key="grupo.categoria.id">
      <h3>{{ grupo.categoria.nome }}</h3>
      <ul class="lista">
        <li v-for="li in grupo.linhas" :key="li.id" :class="{ fora: preparando && !li.nestaIda }">
          <input
            v-if="preparando"
            type="checkbox"
            class="marca"
            :checked="li.nestaIda"
            :aria-label="`Levar ${li.nome} nesta ida`"
            @change="alternar(li, 'nestaIda')"
          />
          <button
            type="button"
            class="icone estrela"
            :class="{ ligada: li.prioritario }"
            :aria-label="li.prioritario ? 'Tirar prioridade' : 'Marcar como prioritário'"
            @click="alternar(li, 'prioritario')"
          >
            {{ li.prioritario ? '★' : '☆' }}
          </button>
          <div class="cresce" @click="editando = editando === li.id ? null : li.id">
            <div>
              {{ li.nome }}
              <span v-if="li.quantidade" class="suave">· {{ li.quantidade }}</span>
            </div>
            <div v-if="editando === li.id" class="edicao" @click.stop>
              <input
                :value="li.quantidade ?? ''"
                placeholder="Quantidade (ex.: 2, 1 kg)"
                @change="mudarQuantidade(li, ($event.target as HTMLInputElement).value)"
              />
              <div class="linha">
                <NuxtLink :to="`/itens/${li.itemId}`" class="suave">Preços do item</NuxtLink>
                <span class="cresce" />
                <button type="button" class="perigo" @click="remover(li)">Tirar da lista</button>
              </div>
            </div>
          </div>
          <span v-if="estimativaExibida(li) !== null" class="suave num">
            ≈ {{ formatarDinheiro(estimativaExibida(li)) }}
          </span>
        </li>
      </ul>
    </section>

    <footer v-if="preparando && dados" class="rodape cartao">
      <p class="resumo-sel">
        <strong>{{ selecionados.length }}</strong> {{ selecionados.length === 1 ? 'item' : 'itens' }} nesta ida
        <span v-if="projecao" class="suave">· budget restante {{ formatarDinheiro(projecao.restante) }}</span>
      </p>
      <div v-for="e in estimativasMercados" :key="e.mercado.id" class="linha estimativa">
        <span class="cresce">{{ e.mercado.nome }}</span>
        <span class="num">≈ {{ formatarDinheiro(e.total) }}</span>
        <span class="suave num">({{ e.cobertos }}/{{ selecionados.length }})</span>
        <button type="button" class="primario" @click="comecar(e.mercado.id, false)">Começar</button>
      </div>
      <p v-if="comparacao" class="suave comparacao">
        Nos {{ comparacao.itens }} itens com preço em todos:
        <span v-for="(c, i) in comparacao.totais" :key="c.nome">
          {{ i ? ' · ' : '' }}{{ c.nome }} <strong class="num">{{ formatarDinheiro(c.total) }}</strong>
        </span>
      </p>
      <p v-if="!dados.mercados.length" class="suave">
        <NuxtLink to="/ajustes#mercados">Cadastre os mercados</NuxtLink> para começar uma compra.
      </p>
    </footer>

    <footer v-else-if="escolhendoMercado && dados" class="rodape cartao">
      <p>Em qual mercado? A lista inteira vai junto.</p>
      <div class="chips">
        <button v-for="m in dados.mercados" :key="m.id" type="button" class="primario" @click="comecar(m.id, true)">
          {{ m.nome }}
        </button>
        <button type="button" @click="escolhendoMercado = false">Cancelar</button>
      </div>
      <p v-if="!dados.mercados.length" class="suave">
        <NuxtLink to="/ajustes#mercados">Cadastre os mercados</NuxtLink> primeiro.
      </p>
    </footer>

    <button
      v-else-if="lista.length && !dados?.compraAtual"
      type="button"
      class="primario comecar"
      @click="escolhendoMercado = true"
    >
      🛒 Começar compra
    </button>
  </main>
</template>

<script setup lang="ts">
import type { ItemResumo, ListaItem, RespostaLista } from '../../shared/types/api'

const dados = ref<RespostaLista | null>(null)
const carregado = ref(false)
const preparando = ref(false)
const escolhendoMercado = ref(false)
const editando = ref<number | null>(null)
const novoNome = ref('')
const { itens, recarregar: recarregarItens } = useItens()
const { categorias, recarregar: recarregarCategorias } = useCategorias()

async function carregar() {
  const resposta = await tentar(() => $fetch<RespostaLista>('/api/lista'))
  if (resposta) dados.value = resposta
  carregado.value = true
}

onMounted(() => {
  carregar()
  recarregarItens().catch(() => {})
  recarregarCategorias().catch(() => {})
})
useAtualizacaoPeriodica(() => {
  if (!editando.value) carregar()
})

const lista = computed(() => dados.value?.itens ?? [])
const grupos = computed(() => agruparPorCategoria(lista.value, categorias.value))
const selecionados = computed(() => lista.value.filter((li) => li.nestaIda))
const projecao = computed(() => (dados.value?.budget.configurado ? projetarBudget(dados.value.budget) : null))
const corRestante = computed(() => {
  if (!projecao.value) return ''
  if (projecao.value.restante < 0) return 'ruim'
  return projecao.value.restante < projecao.value.budget * 0.2 ? 'atencao' : 'ok'
})

// Estimativa da linha: o menor preço conhecido entre os mercados.
function estimativaExibida(li: ListaItem): number | null {
  const valores = Object.values(li.estimativas)
  return valores.length ? Math.min(...valores) : null
}

const estimativasMercados = computed(() =>
  (dados.value?.mercados ?? []).map((mercado) => {
    const comPreco = selecionados.value.filter((li) => li.estimativas[mercado.id] !== undefined)
    return {
      mercado,
      total: comPreco.reduce((s, li) => s + li.estimativas[mercado.id]!, 0),
      cobertos: comPreco.length,
    }
  }),
)

// Comparação justa: só os itens com preço em todos os mercados.
const comparacao = computed(() => {
  const mercados = dados.value?.mercados ?? []
  if (mercados.length < 2) return null
  const comuns = selecionados.value.filter((li) => mercados.every((m) => li.estimativas[m.id] !== undefined))
  if (!comuns.length || comuns.length === selecionados.value.length) return null
  return {
    itens: comuns.length,
    totais: mercados.map((m) => ({ nome: m.nome, total: comuns.reduce((s, li) => s + li.estimativas[m.id]!, 0) })),
  }
})

async function adicionar(corpo: Record<string, unknown>) {
  const r = await tentar(() =>
    $fetch<{ nome: string; jaExistia: boolean }>('/api/lista', { method: 'POST', body: corpo }),
  )
  if (!r) return
  if (r.jaExistia) avisar(`${r.nome} já estava na lista`)
  await Promise.all([carregar(), recarregarItens()])
}

function adicionarExistente(item: ItemResumo) {
  adicionar({ itemId: item.id })
}

function pedirCategoria(nome: string) {
  novoNome.value = nome
}

async function adicionarNovo(categoriaId: number) {
  const nome = novoNome.value
  novoNome.value = ''
  await adicionar({ nome, categoriaId })
}

async function alternar(li: ListaItem, campo: 'prioritario' | 'nestaIda') {
  li[campo] = !li[campo]
  const ok = await tentar(() => $fetch(`/api/lista/${li.id}`, { method: 'PATCH', body: { [campo]: li[campo] } }))
  if (!ok) await carregar()
}

async function mudarQuantidade(li: ListaItem, valor: string) {
  li.quantidade = valor.trim() || null
  await tentar(() => $fetch(`/api/lista/${li.id}`, { method: 'PATCH', body: { quantidade: li.quantidade } }))
  editando.value = null
  await carregar()
}

async function remover(li: ListaItem) {
  editando.value = null
  dados.value!.itens = dados.value!.itens.filter((x) => x.id !== li.id)
  await tentar(() => $fetch(`/api/lista/${li.id}`, { method: 'DELETE' }))
  avisar(`${li.nome} saiu da lista`)
}

async function prepararIda() {
  preparando.value = true
  escolhendoMercado.value = false
  // Primeira vez (nada selecionado): começa pelos prioritários.
  if (!selecionados.value.length) await selecionar('prioritarios')
}

async function selecionar(modo: 'prioritarios' | 'todos' | 'nenhum') {
  await tentar(() => $fetch('/api/lista/selecao', { method: 'POST', body: { modo } }))
  await carregar()
}

async function comecar(mercadoId: number, levarTudo: boolean) {
  const r = await tentar(() => $fetch('/api/compras', { method: 'POST', body: { mercadoId, levarTudo } }))
  if (r) await navigateTo('/mercado')
}
</script>

<style scoped>
.budget {
  font-weight: 600;
  text-decoration: none;
  font-size: 0.95rem;
}

.em-andamento {
  display: block;
  text-decoration: none;
  color: inherit;
}

.novo {
  margin-top: 0.5rem;
}

.novo p {
  margin: 0 0 0.5rem;
}

.modo {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
  margin: 0.75rem 0 0;
  min-height: 2.5rem;
}

.fechar-modo {
  margin-left: auto;
}

.estrela {
  color: var(--texto-suave);
}

.estrela.ligada {
  color: var(--alerta);
}

.marca {
  width: 1.35rem;
  height: 1.35rem;
  min-height: auto;
  accent-color: var(--primaria);
}

li.fora .cresce {
  opacity: 0.55;
}

.cresce {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.edicao {
  margin-top: 0.5rem;
  display: grid;
  gap: 0.5rem;
  cursor: default;
}

.rodape {
  position: sticky;
  bottom: 4.25rem;
  margin-top: 1rem;
}

.rodape p {
  margin: 0 0 0.5rem;
}

.estimativa {
  margin: 0.35rem 0;
}

.comparacao {
  margin-top: 0.5rem;
}

.comecar {
  position: fixed;
  right: 1rem;
  bottom: 4.75rem;
  box-shadow: var(--sombra);
  z-index: 15;
}
</style>
