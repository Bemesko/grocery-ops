<!--
  Campo de item com sugestões dos nomes já usados. Enter escolhe o item de mesmo nome
  (ignorando acento e maiúsculas); senão oferece criar um novo. Emite `escolher` (item
  existente) ou `novo` (nome digitado).
-->
<template>
  <div class="busca">
    <input
      ref="campo"
      v-model="texto"
      type="text"
      :placeholder="placeholder"
      autocomplete="off"
      autocapitalize="sentences"
      enterkeyhint="done"
      @keydown.enter.prevent="confirmar"
      @keydown.down.prevent="mover(1)"
      @keydown.up.prevent="mover(-1)"
      @keydown.esc="texto = ''"
    />
    <ul v-if="texto.trim()" class="sugestoes">
      <li v-for="(s, i) in sugestoes" :key="s.id">
        <button type="button" :class="{ destaque: i === indice }" @click="escolher(s)">
          <span class="cresce">{{ s.nome }}</span>
          <span v-if="!semelhante(s)" class="suave">você quis dizer?</span>
        </button>
      </li>
      <li v-if="!exato">
        <button type="button" :class="{ destaque: indice === sugestoes.length }" @click="novo">
          <span class="cresce">
            Adicionar <strong>“{{ textoLimpo }}”</strong>
          </span>
          <span class="suave">novo</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { ItemResumo } from '../../shared/types/api'

const props = withDefaults(defineProps<{ itens: ItemResumo[]; placeholder?: string; autofocus?: boolean }>(), {
  placeholder: 'Adicionar item…',
  autofocus: false,
})
const emit = defineEmits<{ escolher: [item: ItemResumo]; novo: [nome: string] }>()

const texto = ref('')
const indice = ref(-1)
const campo = ref<HTMLInputElement>()

const textoLimpo = computed(() => limparNome(texto.value))
const sugestoes = computed(() => buscarItens(props.itens, texto.value))
const exato = computed(() => sugestoes.value.find((s) => normalizarNome(s.nome) === normalizarNome(texto.value)))

// Sugestões que só aparecem por erro de digitação ganham o rótulo "você quis dizer?".
function semelhante(s: ItemResumo) {
  return normalizarNome(s.nome).includes(normalizarNome(texto.value))
}

watch(texto, () => {
  indice.value = -1
})

function mover(passo: number) {
  const total = sugestoes.value.length + (exato.value ? 0 : 1)
  if (total) indice.value = (indice.value + passo + total) % total
}

function limpar() {
  texto.value = ''
  indice.value = -1
}

function escolher(item: ItemResumo) {
  emit('escolher', item)
  limpar()
}

function novo() {
  if (!textoLimpo.value) return
  emit('novo', textoLimpo.value)
  limpar()
}

function confirmar() {
  if (indice.value >= 0 && indice.value < sugestoes.value.length) return escolher(sugestoes.value[indice.value]!)
  if (exato.value) return escolher(exato.value)
  novo()
}

defineExpose({ focar: () => campo.value?.focus() })

onMounted(() => {
  if (props.autofocus) campo.value?.focus()
})
</script>

<style scoped>
.busca {
  position: relative;
}

.sugestoes {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0.25rem;
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  box-shadow: var(--sombra);
  position: absolute;
  inset: 100% 0 auto 0;
  z-index: 10;
}

.sugestoes button {
  width: 100%;
  border: 0;
  justify-content: flex-start;
  text-align: left;
  gap: 0.5rem;
}

.sugestoes button.destaque,
.sugestoes button:hover {
  background: var(--primaria-clara);
}

.cresce {
  flex: 1;
}
</style>
