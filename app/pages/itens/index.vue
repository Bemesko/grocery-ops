<!--
  Gestão do cadastro de itens: ver todos por categoria, mudar categoria em lote, juntar
  duplicados (vários de uma vez) e apagar itens que nunca foram usados.
-->
<template>
  <main class="pagina">
    <header class="cabecalho">
      <h1>Itens</h1>
      <div class="cabecalho-acoes">
        <NuxtLink to="/ajustes" class="suave">← Ajustes</NuxtLink>
        <OlhoValores />
      </div>
    </header>

    <div class="linha busca">
      <input v-model="filtro" class="cresce" placeholder="Buscar item" />
      <button type="button" :class="{ primario: selecionando }" @click="alternarSelecao">
        {{ selecionando ? 'Pronto' : 'Selecionar' }}
      </button>
    </div>

    <details v-if="duplicados.length && !filtro" class="cartao duplicados" :open="duplicados.length <= 5">
      <summary>
        <strong>{{ duplicados.length }}</strong> {{ duplicados.length === 1 ? 'possível duplicado' : 'possíveis duplicados' }}
      </summary>
      <ul class="simples">
        <li v-for="d in duplicados" :key="`${d.a.id}-${d.b.id}`" class="par">
          <span class="nomes">
            <NuxtLink :to="`/itens/${d.a.id}`">{{ d.a.nome }}</NuxtLink>
            <span class="suave"> ({{ d.a.usos }})</span> ×
            <NuxtLink :to="`/itens/${d.b.id}`">{{ d.b.nome }}</NuxtLink>
            <span class="suave"> ({{ d.b.usos }})</span>
          </span>
          <span class="chips">
            <button type="button" class="chip" @click="juntar(d.a, [d.b])">Fica “{{ d.a.nome }}”</button>
            <button type="button" class="chip" @click="juntar(d.b, [d.a])">Fica “{{ d.b.nome }}”</button>
            <button type="button" class="chip" @click="ignorar(d.a, d.b)">São diferentes</button>
          </span>
        </li>
      </ul>
    </details>

    <p v-if="carregado && !visiveis.length" class="vazio">
      {{ filtro ? 'Nenhum item encontrado.' : 'Nenhum item ainda. Eles aparecem ao anotar na lista.' }}
    </p>

    <section v-for="grupo in grupos" :key="grupo.categoria.id">
      <h3 class="linha">
        <span class="cresce">{{ grupo.categoria.nome }}</span>
        <button
          v-if="selecionando"
          type="button"
          class="texto"
          @click="selecionarGrupo(grupo.linhas)"
        >
          {{ grupo.linhas.every((i) => selecionados.has(i.id)) ? 'Nenhum' : 'Todos' }}
        </button>
      </h3>
      <ul class="lista">
        <li v-for="i in grupo.linhas" :key="i.id" :class="{ marcado: selecionados.has(i.id) }">
          <input
            v-if="selecionando"
            type="checkbox"
            class="marca"
            :checked="selecionados.has(i.id)"
            :aria-label="`Selecionar ${i.nome}`"
            @change="alternar(i.id)"
          />
          <component
            :is="selecionando ? 'span' : NuxtLinkComponent"
            :to="selecionando ? undefined : `/itens/${i.id}`"
            class="cresce link"
            @click="selecionando && alternar(i.id)"
          >
            <span>{{ i.nome }}</span>
            <span class="suave detalhe">
              {{ i.unidade === 'kg' ? 'por kg' : formatarEmbalagem(i.embalagem) || 'unidade' }}
              · {{ i.usos ? `${i.usos} ${i.usos === 1 ? 'uso' : 'usos'}` : 'sem uso' }}
            </span>
          </component>
          <span v-if="menorPreco(i) !== null" class="suave num">{{ formatarDinheiro(menorPreco(i)) }}</span>
          <button
            v-if="!i.usos && !selecionando"
            type="button"
            class="icone"
            :aria-label="`Apagar ${i.nome}`"
            @click="apagar(i)"
          >
            🗑
          </button>
        </li>
      </ul>
    </section>

    <footer v-if="selecionando && selecionados.size" class="rodape cartao">
      <template v-if="acao === 'mover'">
        <p>Mover {{ selecionados.size }} {{ selecionados.size === 1 ? 'item' : 'itens' }} para:</p>
        <EscolhaCategoria :model-value="null" @update:model-value="mover" />
        <button type="button" class="texto" @click="acao = null">Cancelar</button>
      </template>
      <template v-else-if="acao === 'juntar'">
        <p>Juntar {{ selecionados.size }} itens. Qual nome fica?</p>
        <div class="chips">
          <button v-for="i in itensSelecionados" :key="i.id" type="button" class="chip" @click="juntarSelecionados(i)">
            {{ i.nome }}
          </button>
        </div>
        <p class="suave">As compras e a lista dos outros passam para ele, e os outros somem.</p>
        <button type="button" class="texto" @click="acao = null">Cancelar</button>
      </template>
      <div v-else class="linha barra-acoes">
        <span class="cresce"><strong>{{ selecionados.size }}</strong> {{ selecionados.size === 1 ? 'selecionado' : 'selecionados' }}</span>
        <button type="button" @click="acao = 'mover'">Mover…</button>
        <button type="button" :disabled="selecionados.size < 2" @click="acao = 'juntar'">Juntar…</button>
        <button type="button" class="texto" @click="selecionados = new Set()">Limpar</button>
      </div>
    </footer>
  </main>
</template>

<script setup lang="ts">
import type { ItemResumo } from '../../../shared/types/api'

const NuxtLinkComponent = resolveComponent('NuxtLink')
const { itens, recarregar: recarregarItens } = useItens()
const { categorias, recarregar: recarregarCategorias } = useCategorias()
const carregado = ref(false)
const filtro = ref('')
const selecionando = ref(false)
const selecionados = ref(new Set<number>())
const acao = ref<'mover' | 'juntar' | null>(null)

// Pares marcados como "são diferentes" ficam só neste aparelho.
const CHAVE_IGNORADOS = 'itens-diferentes'
const ignorados = ref(new Set<string>())

async function carregar() {
  await tentar(() => Promise.all([recarregarItens(), recarregarCategorias()]))
  carregado.value = true
}

onMounted(() => {
  try {
    ignorados.value = new Set(JSON.parse(localStorage.getItem(CHAVE_IGNORADOS) ?? '[]'))
  } catch {
    ignorados.value = new Set()
  }
  carregar()
})

const visiveis = computed(() => (filtro.value ? buscarItens(itens.value, filtro.value, 200) : itens.value))
const grupos = computed(() =>
  agruparPorCategoria(
    [...visiveis.value].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    categorias.value,
  ),
)
const itensSelecionados = computed(() => itens.value.filter((i) => selecionados.value.has(i.id)))

const chavePar = (a: ItemResumo, b: ItemResumo) => [a.id, b.id].sort((x, y) => x - y).join('-')
const duplicados = computed(() =>
  possiveisDuplicados(itens.value).filter((d) => !ignorados.value.has(chavePar(d.a, d.b))),
)

function menorPreco(i: ItemResumo): number | null {
  const precos = Object.values(i.precos).map((p) => p.preco)
  return precos.length ? Math.min(...precos) : null
}

function alternarSelecao() {
  selecionando.value = !selecionando.value
  selecionados.value = new Set()
  acao.value = null
}

function alternar(id: number) {
  const novo = new Set(selecionados.value)
  if (novo.has(id)) novo.delete(id)
  else novo.add(id)
  selecionados.value = novo
}

function selecionarGrupo(linhas: ItemResumo[]) {
  const novo = new Set(selecionados.value)
  const todos = linhas.every((i) => novo.has(i.id))
  for (const i of linhas) {
    if (todos) novo.delete(i.id)
    else novo.add(i.id)
  }
  selecionados.value = novo
}

function ignorar(a: ItemResumo, b: ItemResumo) {
  const novo = new Set(ignorados.value)
  novo.add(chavePar(a, b))
  ignorados.value = novo
  try {
    localStorage.setItem(CHAVE_IGNORADOS, JSON.stringify([...novo]))
  } catch {
    // sem armazenamento local: vale só até recarregar a página
  }
}

async function mover(categoriaId: number) {
  const ids = [...selecionados.value]
  const ok = await tentar(() => $fetch('/api/itens/lote', { method: 'POST', body: { ids, categoriaId } }))
  if (!ok) return
  const categoria = categorias.value.find((c) => c.id === categoriaId)?.nome
  avisar(`${ids.length} ${ids.length === 1 ? 'item movido' : 'itens movidos'} para ${categoria}`)
  selecionados.value = new Set()
  acao.value = null
  await carregar()
}

async function juntar(destino: ItemResumo, origens: ItemResumo[]) {
  const nomes = origens.map((o) => `“${o.nome}”`).join(', ')
  if (!confirm(`Juntar ${nomes} em “${destino.nome}”? Não dá para desfazer.`)) return false
  const ok = await tentar(() =>
    $fetch('/api/itens/juntar', { method: 'POST', body: { destinoId: destino.id, origemIds: origens.map((o) => o.id) } }),
  )
  if (!ok) return false
  avisar(`Juntado em ${destino.nome}`)
  await carregar()
  return true
}

async function juntarSelecionados(destino: ItemResumo) {
  const origens = itensSelecionados.value.filter((i) => i.id !== destino.id)
  if (!(await juntar(destino, origens))) return
  selecionados.value = new Set()
  acao.value = null
}

async function apagar(i: ItemResumo) {
  if (!confirm(`Apagar “${i.nome}”? Ele nunca foi usado.`)) return
  const ok = await tentar(() => $fetch(`/api/itens/${i.id}`, { method: 'DELETE' }))
  if (!ok) return
  avisar(`${i.nome} apagado`)
  await carregar()
}
</script>

<style scoped>
.busca {
  margin-bottom: 0.75rem;
}

.duplicados summary {
  cursor: pointer;
}

.duplicados ul {
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.par {
  display: grid;
  gap: 0.35rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--borda);
}

.cresce {
  flex: 1;
  min-width: 0;
}

.link {
  display: grid;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.detalhe {
  font-size: 0.8rem;
}

.marca {
  width: 1.35rem;
  height: 1.35rem;
  min-height: auto;
  accent-color: var(--primaria);
}

li.marcado {
  background: var(--primaria-clara);
}

h3.linha {
  align-items: baseline;
}

.rodape {
  position: sticky;
  bottom: 4.25rem;
  margin-top: 1rem;
  display: grid;
  gap: 0.5rem;
}

.barra-acoes {
  flex-wrap: wrap;
}

.barra-acoes .cresce {
  flex-basis: 100%;
}

.rodape p {
  margin: 0;
}
</style>
