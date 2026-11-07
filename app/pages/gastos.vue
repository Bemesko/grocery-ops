<template>
  <main class="pagina">
    <header class="cabecalho">
      <h1>Gastos</h1>
      <NuxtLink to="/compras" class="suave">Compras →</NuxtLink>
    </header>

    <div class="meses linha">
      <button type="button" class="icone" aria-label="Mês anterior" :disabled="!anterior" @click="ir(anterior)">‹</button>
      <strong class="cresce mes">{{ nomeMes(mes) }}</strong>
      <button type="button" class="icone" aria-label="Próximo mês" :disabled="!proximo" @click="ir(proximo)">›</button>
    </div>

    <template v-if="g">
      <p v-if="!g.compras" class="vazio">
        Nenhuma compra neste mês.<br />
        <NuxtLink to="/ajustes#importar">Importar histórico</NuxtLink>
      </p>
      <template v-else>
        <div class="cartao totais">
          <div>
            <span class="suave">Total</span>
            <strong class="num grande">{{ formatarDinheiro(g.total) }}</strong>
          </div>
          <div>
            <span class="suave">Compras</span>
            <strong class="num grande">{{ g.compras }}</strong>
          </div>
          <div v-if="g.foraDaLista.conhecido">
            <span class="suave">Fora da lista</span>
            <strong class="num grande">{{ formatarPercentual(g.foraDaLista.total / g.foraDaLista.conhecido) }}</strong>
          </div>
        </div>

        <h2>O que mais pesou</h2>
        <ul class="lista">
          <li v-for="(i, n) in g.topItens" :key="i.itemId">
            <NuxtLink :to="`/itens/${i.itemId}`" class="barra-linha">
              <span class="linha">
                <span class="cresce">{{ n + 1 }}. {{ i.nome }}</span>
                <span class="suave num">{{ formatarQuantidade(i.quantidade, i.unidade) }}</span>
                <span class="num">{{ formatarDinheiro(i.total) }}</span>
              </span>
              <span class="barra"><span :style="{ width: `${(i.total / maiorItem) * 100}%` }" /></span>
            </NuxtLink>
          </li>
        </ul>

        <h2>Por categoria</h2>
        <ul class="lista">
          <li v-for="c in g.porCategoria" :key="c.categoria">
            <span class="barra-linha">
              <span class="linha">
                <span class="cresce">{{ c.categoria }}</span>
                <span class="suave num">{{ formatarPercentual(c.total / g.total) }}</span>
                <span class="num">{{ formatarDinheiro(c.total) }}</span>
              </span>
              <span class="barra"><span :style="{ width: `${(c.total / maiorCategoria) * 100}%` }" /></span>
            </span>
          </li>
        </ul>

        <template v-if="g.porMercado.length > 1">
          <h2>Por mercado</h2>
          <ul class="lista">
            <li v-for="m in g.porMercado" :key="m.mercado">
              <span class="cresce">{{ m.mercado }}</span>
              <span class="suave num">{{ formatarPercentual(m.total / g.total) }}</span>
              <span class="num">{{ formatarDinheiro(m.total) }}</span>
            </li>
          </ul>
        </template>
      </template>
    </template>
  </main>
</template>

<script setup lang="ts">
import type { Gastos } from '../../shared/types/api'

const rota = useRoute()
const g = ref<Gastos | null>(null)
const mes = ref(typeof rota.query.mes === 'string' ? rota.query.mes : '')

async function carregar() {
  const r = await tentar(() => $fetch<Gastos>('/api/gastos', { query: mes.value ? { mes: mes.value } : {} }))
  if (r) {
    g.value = r
    mes.value = r.mes
  }
}
onMounted(carregar)

function somarMes(m: string, n: number) {
  const [a, mm] = m.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(a, mm - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

// Navega mês a mês, até o mais antigo com compras e até o mês atual.
const anterior = computed(() => {
  if (!g.value) return ''
  const antigo = g.value.meses.at(-1)
  return antigo && antigo < mes.value ? somarMes(mes.value, -1) : ''
})
const proximo = computed(() => {
  const atual = new Date().toISOString().slice(0, 7)
  return mes.value && mes.value < atual ? somarMes(mes.value, 1) : ''
})

function ir(m: string) {
  if (!m) return
  mes.value = m
  navigateTo({ query: { mes: m } }, { replace: true })
  carregar()
}

function nomeMes(m: string) {
  if (!m) return ''
  const [a, mm] = m.split('-').map(Number) as [number, number]
  const nome = new Date(a, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

const maiorItem = computed(() => Math.max(1, ...(g.value?.topItens.map((i) => i.total) ?? [])))
const maiorCategoria = computed(() => Math.max(1, ...(g.value?.porCategoria.map((c) => c.total) ?? [])))
</script>

<style scoped>
.meses {
  margin-bottom: 0.75rem;
}

.mes {
  text-align: center;
}

.totais {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
  gap: 0.75rem;
}

.totais div {
  display: grid;
}

.grande {
  font-size: 1.35rem;
}

.cresce {
  flex: 1;
  min-width: 0;
}

.barra-linha {
  display: grid;
  gap: 0.3rem;
  width: 100%;
  color: inherit;
  text-decoration: none;
}
</style>
