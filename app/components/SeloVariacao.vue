<template>
  <span v-if="variacao" class="selo" :class="classe" :title="titulo">
    {{ texto }}
  </span>
</template>

<script setup lang="ts">
import type { Variacao } from '../../shared/types/api'

const props = defineProps<{ variacao: Variacao | null }>()

const igual = computed(() => Math.abs(props.variacao?.percentual ?? 0) < 0.01)
const classe = computed(() => (igual.value ? 'igual' : (props.variacao?.percentual ?? 0) > 0 ? 'sobe' : 'desce'))
const texto = computed(() => {
  const v = props.variacao
  if (!v) return ''
  const sufixo = v.outroMercado ? ` vs ${v.outroMercado}` : ''
  if (igual.value) return `=${sufixo}`
  return `${v.percentual > 0 ? '▲' : '▼'} ${formatarPercentual(Math.abs(v.percentual))}${sufixo}`
})
const titulo = computed(() => (props.variacao ? `Antes: ${formatarDinheiro(props.variacao.anterior)}` : ''))
</script>
