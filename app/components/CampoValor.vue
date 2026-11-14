<!--
  Campo de número com casas fixas que preenche da direita para a esquerda (#53): digitar 1,
  4, 9 mostra 0,01 → 0,14 → 1,49, sem precisar da vírgula. 2 casas para dinheiro, 3 para
  kg. O valor é o mesmo texto de antes ("1,49"), lido com parseDinheiro / parseNumero.
-->
<template>
  <input
    ref="campo"
    :value="modelValue"
    type="text"
    inputmode="numeric"
    autocomplete="off"
    @input="aoDigitar"
  />
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue: string; casas?: number }>(), { casas: 2 })
const emit = defineEmits<{ 'update:modelValue': [valor: string] }>()
const campo = ref<HTMLInputElement>()

function aoDigitar(e: Event) {
  const el = e.target as HTMLInputElement
  const valor = formatarDigitos(el.value, props.casas)
  el.value = valor
  // O cursor fica no fim: os dígitos entram sempre pela direita.
  el.setSelectionRange(valor.length, valor.length)
  emit('update:modelValue', valor)
}

defineExpose({ focus: () => campo.value?.focus() })
</script>
