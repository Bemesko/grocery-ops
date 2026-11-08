<!-- Marca de item prioritário: "!" num círculo laranja (desligada: só o contorno, em cinza). -->
<template>
  <span class="marca-prioridade" :class="{ ligada, pequena }" aria-hidden="true">!</span>
</template>

<script setup lang="ts">
defineProps<{ ligada: boolean; pequena?: boolean }>()
</script>

<style scoped>
.marca-prioridade {
  display: inline-grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  border: 2px solid var(--borda);
  color: var(--texto-suave);
  font-weight: 800;
  font-size: 0.85rem;
  line-height: 1;
  flex: none;
}

.marca-prioridade.pequena {
  width: 1.1rem;
  height: 1.1rem;
  font-size: 0.7rem;
  vertical-align: text-bottom;
  margin-right: 0.15rem;
}

.marca-prioridade.ligada {
  background: var(--prioridade);
  border-color: var(--prioridade);
  color: var(--superficie);
}
</style>
