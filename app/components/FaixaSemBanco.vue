<!--
  Faixa fixa quando a API responde 503 por falta de banco. Enquanto visível, tenta de novo
  a cada 10 s; quando o banco volta, recarrega o app para as telas buscarem os dados.
-->
<template>
  <div v-if="semBanco" class="faixa" role="alert">
    <strong>Sem conexão com o banco de dados.</strong>
    Nada pode ser lido nem salvo agora; tentando de novo…
  </div>
</template>

<script setup lang="ts">
const semBanco = useSemBanco()
let timer: ReturnType<typeof setInterval> | undefined

async function verificar() {
  try {
    await $fetch('/api/categorias')
    semBanco.value = false
    reloadNuxtApp({ persistState: false })
  } catch (e) {
    if (!ehSemBanco(e)) semBanco.value = false
  }
}

watch(semBanco, (ativo) => {
  clearInterval(timer)
  if (ativo) timer = setInterval(verificar, 10_000)
})

onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.faixa {
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--perigo);
  color: #fff;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
  text-align: center;
}
</style>
