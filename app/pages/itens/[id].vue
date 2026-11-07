<template>
  <main class="pagina">
    <header class="cabecalho">
      <a href="#" class="suave" @click.prevent="$router.back()">← Voltar</a>
    </header>

    <template v-if="d">
      <h1>{{ d.item.nome }}</h1>
      <p class="suave">{{ d.item.categoria }} · por {{ d.item.unidade === 'kg' ? 'kg' : 'unidade' }}</p>

      <h2>Último preço por mercado</h2>
      <p v-if="!d.ultimoPorMercado.length" class="suave">Ainda sem compras registradas.</p>
      <ul v-else class="lista">
        <li v-for="u in d.ultimoPorMercado" :key="u.mercadoId">
          <span class="cresce">
            {{ u.mercado }}
            <span class="suave">· {{ dataCurta(u.data) }}<template v-if="u.variante"> · {{ u.variante }}</template></span>
          </span>
          <strong class="num">{{ formatarDinheiro(u.precoUnitario) }}{{ u.unidade === 'kg' ? '/kg' : '' }}</strong>
        </li>
      </ul>

      <h2>Compras</h2>
      <ul v-if="d.compras.length" class="lista">
        <li v-for="c in d.compras" :key="`${c.compraId}-${c.data}-${c.precoUnitario}`">
          <NuxtLink :to="`/compras/${c.compraId}`" class="linha cresce link">
            <span class="cresce">
              {{ dataCurta(c.data) }} · {{ c.mercado }}
              <span class="suave">· {{ formatarQuantidade(c.quantidade, c.unidade) }}</span>
            </span>
            <span class="suave num">{{ formatarDinheiro(c.precoUnitario) }}</span>
            <span class="num">{{ formatarDinheiro(c.total) }}</span>
          </NuxtLink>
        </li>
      </ul>

      <h2>Editar</h2>
      <form class="cartao" @submit.prevent="salvar">
        <label for="nome">Nome</label>
        <input id="nome" v-model="nome" />
        <label>Categoria</label>
        <EscolhaCategoria v-model="categoriaId" />
        <label>Unidade padrão</label>
        <div class="chips">
          <button type="button" class="chip" :class="{ ativo: unidade === 'un' }" @click="unidade = 'un'">Unidade</button>
          <button type="button" class="chip" :class="{ ativo: unidade === 'kg' }" @click="unidade = 'kg'">kg</button>
        </div>
        <div class="linha acoes">
          <button type="submit" class="primario">Salvar</button>
        </div>
      </form>

      <h2>Juntar com outro item</h2>
      <p class="suave">
        Para duplicados (ex.: “Pão de forma” e “Pao forma”): as compras e a lista de
        <strong>{{ d.item.nome }}</strong> passam para o item escolhido, e este some.
      </p>
      <BuscaItem :itens="outrosItens" placeholder="Juntar em…" @escolher="juntar" @novo="() => avisar('Escolha um item existente')" />
    </template>
  </main>
</template>

<script setup lang="ts">
import type { ItemResumo, Unidade } from '../../../shared/types/api'

interface Detalhe {
  item: { id: number; nome: string; categoriaId: number; unidade: Unidade; categoria: string }
  ultimoPorMercado: { mercadoId: number; mercado: string; data: string; precoUnitario: number; unidade: Unidade; variante: string | null }[]
  compras: {
    compraId: number
    data: string
    mercado: string
    quantidade: number
    unidade: Unidade
    precoUnitario: number
    total: number
  }[]
}

const rota = useRoute()
const id = Number(rota.params.id)
const d = ref<Detalhe | null>(null)
const nome = ref('')
const categoriaId = ref<number | null>(null)
const unidade = ref<Unidade>('un')
const { itens, recarregar: recarregarItens } = useItens()
const { recarregar: recarregarCategorias } = useCategorias()

async function carregar() {
  const r = await tentar(() => $fetch<Detalhe>(`/api/itens/${id}`))
  if (!r) return
  d.value = r
  nome.value = r.item.nome
  categoriaId.value = r.item.categoriaId
  unidade.value = r.item.unidade
}

onMounted(() => {
  carregar()
  recarregarCategorias().catch(() => {})
  if (!itens.value.length) recarregarItens().catch(() => {})
})

const outrosItens = computed(() => itens.value.filter((i) => i.id !== id))

function dataCurta(dia: string) {
  const [a, m, dd] = dia.split('-')
  return `${dd}/${m}/${a!.slice(2)}`
}

async function salvar() {
  const ok = await tentar(() =>
    $fetch(`/api/itens/${id}`, {
      method: 'PATCH',
      body: { nome: nome.value, categoriaId: categoriaId.value, unidade: unidade.value },
    }),
  )
  if (!ok) return
  avisar('Item salvo')
  await Promise.all([carregar(), recarregarItens()])
}

async function juntar(destino: ItemResumo) {
  if (!d.value || !confirm(`Juntar “${d.value.item.nome}” em “${destino.nome}”?`)) return
  const ok = await tentar(() => $fetch(`/api/itens/${id}/juntar`, { method: 'POST', body: { destinoId: destino.id } }))
  if (!ok) return
  avisar(`Juntado em ${destino.nome}`)
  await recarregarItens()
  await navigateTo(`/itens/${destino.id}`, { replace: true })
}
</script>

<style scoped>
.cresce {
  flex: 1;
  min-width: 0;
}

.link {
  color: inherit;
  text-decoration: none;
}

.acoes {
  justify-content: flex-end;
  margin-top: 0.75rem;
}
</style>
