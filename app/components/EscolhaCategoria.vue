<template>
  <div class="chips" role="radiogroup" aria-label="Categoria">
    <button
      v-for="c in categorias"
      :key="c.id"
      type="button"
      class="chip"
      :class="{ ativo: modelValue === c.id }"
      role="radio"
      :aria-checked="modelValue === c.id"
      @click="emit('update:modelValue', c.id)"
    >
      {{ c.nome }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [id: number] }>()
const { categorias } = useCategorias()
</script>
