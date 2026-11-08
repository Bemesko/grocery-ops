<!-- Liga/desliga o modo "ocultar valores" (todos os valores em R$ do app). -->
<template>
  <button
    type="button"
    class="icone olho"
    :aria-pressed="ocultos"
    :aria-label="ocultos ? 'Mostrar valores' : 'Ocultar valores'"
    :title="ocultos ? 'Mostrar valores' : 'Ocultar valores'"
    @click="alternar"
  >
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      <line v-if="ocultos" x1="3" y1="3" x2="21" y2="21" />
    </svg>
  </button>
</template>

<script setup lang="ts">
const { ocultos, alternar } = useOcultarValores()
</script>

<style scoped>
.olho {
  color: var(--texto-suave);
  flex: none;
}

.olho[aria-pressed='true'] {
  color: var(--primaria);
}

svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
