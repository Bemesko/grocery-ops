<!-- "Encolheu 1 kg → 800 g · +25%/kg": a embalagem diminuiu e o preço por conteúdo subiu. -->
<template>
  <span v-if="reduflacao" class="selo reduflacao" :title="titulo">
    📉 {{ formatarEmbalagem(reduflacao.de) }} → {{ formatarEmbalagem(reduflacao.para) }}
    · +{{ formatarPercentual(reduflacao.percentual) }}{{ rotuloBase(baseDe(reduflacao.para.unidade)) }}
  </span>
</template>

<script setup lang="ts">
import type { Reduflacao } from '../../shared/utils/embalagem'

const props = defineProps<{ reduflacao: Reduflacao | null | undefined }>()
const titulo = computed(() =>
  props.reduflacao ? 'Reduflação: a embalagem encolheu e o preço por conteúdo subiu' : '',
)
</script>

<style scoped>
.reduflacao {
  background: var(--prioridade-clara);
  color: var(--texto);
  font-weight: 600;
}
</style>
