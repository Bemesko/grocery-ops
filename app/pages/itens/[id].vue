<template>
  <main class="pagina">
    <header class="cabecalho">
      <a href="#" class="suave" @click.prevent="$router.back()">← Voltar</a>
      <OlhoValores />
    </header>

    <template v-if="d">
      <h1>{{ d.item.nome }}</h1>
      <p class="suave">
        {{ d.item.categoria }} · por {{ d.item.unidade === 'kg' ? 'kg' : 'unidade' }}
        <template v-if="d.item.embalagem"> · embalagem habitual {{ formatarEmbalagem(d.item.embalagem) }}</template>
      </p>

      <h2>Último preço por mercado</h2>
      <p v-if="!d.ultimoPorMercado.length" class="suave">Ainda sem compras registradas.</p>
      <ul v-else class="lista">
        <li v-for="u in d.ultimoPorMercado" :key="u.mercadoId">
          <span class="cresce">
            {{ u.mercado }}
            <span class="suave">
              · {{ dataCurta(u.data) }}<template v-if="u.variante"> · {{ u.variante }}</template>
              <template v-if="u.embalagem"> · {{ formatarEmbalagem(u.embalagem) }}</template>
            </span>
          </span>
          <span class="precos">
            <strong class="num">{{ formatarDinheiro(u.precoUnitario) }}{{ u.unidade === 'kg' ? '/kg' : '' }}</strong>
            <span v-if="porConteudo(u)" class="suave num">{{ porConteudo(u) }}</span>
          </span>
        </li>
      </ul>

      <h2>Compras</h2>
      <ul v-if="d.compras.length" class="lista">
        <li v-for="c in d.compras" :key="`${c.compraId}-${c.data}-${c.precoUnitario}`">
          <NuxtLink :to="`/compras/${c.compraId}`" class="linha cresce link">
            <span class="cresce">
              {{ dataCurta(c.data) }} · {{ c.mercado }}
              <span class="suave">
                · {{ formatarQuantidade(c.quantidade, c.unidade) }}
                <template v-if="c.embalagem"> de {{ formatarEmbalagem(c.embalagem) }}</template>
              </span>
              <SeloReduflacao :reduflacao="c.reduflacao" />
            </span>
            <span class="precos">
              <span class="suave num">{{ formatarDinheiro(c.precoUnitario) }}</span>
              <span v-if="porConteudo(c)" class="suave num">{{ porConteudo(c) }}</span>
            </span>
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
        <template v-if="unidade === 'un'">
          <label for="embalagem">Embalagem habitual <span class="suave">(opcional)</span></label>
          <input id="embalagem" v-model="embalagemTexto" placeholder="ex.: 1 kg, 900 ml, 12 un" />
          <p class="suave dica">
            O tamanho que a casa costuma levar. As estimativas da lista usam o preço por kg/L/un para comparar
            mercados que vendem embalagens diferentes.
          </p>
        </template>
        <div class="linha acoes">
          <button type="submit" class="primario" :disabled="embalagemInvalida">Salvar</button>
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
import type { Embalagem, Reduflacao } from '../../../shared/utils/embalagem'

interface CompraDoItem {
  compraId: number
  mercadoId: number
  data: string
  mercado: string
  quantidade: number
  unidade: Unidade
  precoUnitario: number
  variante: string | null
  embalagem: Embalagem | null
  precoBase: number | null
  reduflacao: Reduflacao | null
  total: number
}

interface Detalhe {
  item: { id: number; nome: string; categoriaId: number; unidade: Unidade; categoria: string; embalagem: Embalagem | null }
  ultimoPorMercado: CompraDoItem[]
  compras: CompraDoItem[]
}

const rota = useRoute()
const id = Number(rota.params.id)
const d = ref<Detalhe | null>(null)
const nome = ref('')
const categoriaId = ref<number | null>(null)
const unidade = ref<Unidade>('un')
const embalagemTexto = ref('')
const embalagemInvalida = computed(() => Boolean(embalagemTexto.value.trim()) && !lerEmbalagem(embalagemTexto.value))
const { itens, recarregar: recarregarItens } = useItens()
const { recarregar: recarregarCategorias } = useCategorias()

async function carregar() {
  const r = await tentar(() => $fetch<Detalhe>(`/api/itens/${id}`))
  if (!r) return
  d.value = r
  nome.value = r.item.nome
  categoriaId.value = r.item.categoriaId
  unidade.value = r.item.unidade
  embalagemTexto.value = formatarEmbalagem(r.item.embalagem)
}

/** "R$ 22,50/kg" para compras com embalagem (exceto 1 un). */
function porConteudo(c: CompraDoItem) {
  if (!c.embalagem || c.precoBase === null || (c.embalagem.unidade === 'un' && c.embalagem.qtd === 1)) return ''
  return `${formatarDinheiro(c.precoBase)}${rotuloBase(baseDe(c.embalagem.unidade))}`
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
      body: {
        nome: nome.value,
        categoriaId: categoriaId.value,
        unidade: unidade.value,
        embalagem: unidade.value === 'un' ? lerEmbalagem(embalagemTexto.value) : null,
      },
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

.precos {
  display: grid;
  justify-items: end;
}

.dica {
  font-size: 0.8rem;
  margin: 0.25rem 0 0;
}

.acoes {
  justify-content: flex-end;
  margin-top: 0.75rem;
}
</style>
