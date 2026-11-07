<script setup lang="ts">
const { $pwa } = useNuxtApp()
const { data } = await useFetch('/api/version')
</script>

<template>
  <main class="page">
    <h1>Grocery Ops</h1>
    <p>Lista de compras e acompanhamento do carrinho no mercado. Em construção.</p>
    <button v-if="$pwa?.showInstallPrompt" type="button" @click="$pwa.install()">
      Instalar no celular
    </button>
    <p class="version">versão {{ data?.version ?? '…' }}</p>
  </main>
</template>

<style scoped>
.page {
  font-family: system-ui, sans-serif;
  max-width: 32rem;
  margin: 3rem auto;
  padding: 0 1rem;
}

button {
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 0.5rem;
  background: #2f855a;
  color: #fff;
  font-size: 1rem;
}

.version {
  color: #718096;
  font-size: 0.875rem;
}
</style>
