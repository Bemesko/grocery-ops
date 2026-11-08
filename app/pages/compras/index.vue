<template>
  <main class="pagina">
    <header class="cabecalho">
      <h1>Compras</h1>
      <div class="cabecalho-acoes">
        <NuxtLink to="/gastos" class="suave">Gastos do mês →</NuxtLink>
        <OlhoValores />
      </div>
    </header>
    <p v-if="carregado && !compras.length" class="vazio">Nenhuma compra finalizada ainda.</p>
    <ul v-else class="lista">
      <li v-for="c in compras" :key="c.id">
        <NuxtLink :to="`/compras/${c.id}`" class="linha cresce">
          <span class="cresce">
            <strong>{{ c.mercado }}</strong>
            <span class="suave"> · {{ dataCurta(c.data) }} · {{ c.itens }} itens</span>
            <span v-if="c.origem === 'importacao'" class="selo neutro">importada</span>
          </span>
          <span class="num">{{ formatarDinheiro(c.total) }}</span>
        </NuxtLink>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import type { Compra } from '../../../shared/types/api'

const compras = ref<(Compra & { itens: number })[]>([])
const carregado = ref(false)

onMounted(async () => {
  const r = await tentar(() => $fetch<(Compra & { itens: number })[]>('/api/compras?limite=200'))
  if (!r) return
  compras.value = r
  carregado.value = true
})

function dataCurta(dia: string) {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
a.linha {
  color: inherit;
  text-decoration: none;
}

.cresce {
  flex: 1;
  min-width: 0;
}
</style>
