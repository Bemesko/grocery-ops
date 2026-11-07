<template>
  <nav class="nav">
    <NuxtLink to="/" :class="{ ativo: rota.path === '/' }">
      <span aria-hidden="true">📝</span>
      Lista
    </NuxtLink>
    <NuxtLink to="/mercado" :class="{ ativo: rota.path === '/mercado' }">
      <span aria-hidden="true">🛒</span>
      Mercado
    </NuxtLink>
    <NuxtLink to="/gastos" :class="{ ativo: rota.path.startsWith('/gastos') || rota.path.startsWith('/compras') }">
      <span aria-hidden="true">📊</span>
      Gastos
    </NuxtLink>
    <NuxtLink to="/ajustes" :class="{ ativo: rota.path.startsWith('/ajustes') || rota.path.startsWith('/itens') }">
      <span aria-hidden="true">⚙️</span>
      Ajustes
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const rota = useRoute()
</script>

<style scoped>
.nav {
  position: fixed;
  inset: auto 0 0 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--superficie);
  border-top: 1px solid var(--borda);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 20;
}

.nav a {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.45rem 0;
  font-size: 0.75rem;
  color: var(--texto-suave);
  text-decoration: none;
}

.nav a span {
  font-size: 1.25rem;
  filter: grayscale(1);
  opacity: 0.7;
}

.nav a.ativo {
  color: var(--primaria);
  font-weight: 600;
}

.nav a.ativo span {
  filter: none;
  opacity: 1;
}
</style>
