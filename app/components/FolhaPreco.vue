<!--
  Folha para registrar (ou corrigir) um item no carrinho. Com o preço da última vez naquele
  mercado, um toque em "Mesmo preço" registra sem digitar.
-->
<template>
  <div class="fundo" @click.self="emit('fechar')">
    <form class="folha" @submit.prevent="salvar()">
      <div class="cabecalho">
        <h2>{{ titulo }}</h2>
        <button type="button" class="icone" aria-label="Fechar" @click="emit('fechar')">✕</button>
      </div>

      <p v-if="referencia" class="suave">
        {{ inicial ? 'Compra anterior aqui' : 'Última vez aqui' }}:<strong class="num">{{ formatarDinheiro(referencia.preco) }}</strong>
        {{ unidadeRef === 'kg' ? '/kg' : '' }}
        <span v-if="referencia.variante">· {{ referencia.variante }}</span>
        <span v-if="referencia.data">· {{ dataCurta(referencia.data) }}</span>
      </p>

      <template v-if="precisaCategoria">
        <label>Categoria (item novo)</label>
        <EscolhaCategoria v-model="categoriaId" />
      </template>

      <div class="chips unidade" role="radiogroup" aria-label="Unidade">
        <button type="button" class="chip" :class="{ ativo: un === 'un' }" @click="un = 'un'">Por unidade</button>
        <button type="button" class="chip" :class="{ ativo: un === 'kg' }" @click="un = 'kg'">Por kg</button>
      </div>

      <div class="campos">
        <div>
          <label for="preco">{{ un === 'kg' ? 'Preço por kg' : 'Preço da unidade' }}</label>
          <input
            id="preco"
            ref="campoPreco"
            v-model="precoTexto"
            inputmode="decimal"
            :placeholder="referencia && unidadeRef === un ? dinheiroParaCampo(referencia.preco) : '0,00'"
            autocomplete="off"
          />
        </div>
        <div v-if="un === 'kg'">
          <label for="peso">Peso (kg)</label>
          <input id="peso" v-model="pesoTexto" inputmode="decimal" placeholder="0,000" autocomplete="off" />
        </div>
        <div v-else>
          <label>Quantidade</label>
          <div class="linha">
            <button type="button" aria-label="Menos" @click="unidades = Math.max(1, unidades - 1)">−</button>
            <input v-model.number="unidades" class="qtd num" inputmode="numeric" aria-label="Quantidade" />
            <button type="button" aria-label="Mais" @click="unidades++">+</button>
          </div>
        </div>
      </div>

      <div v-if="un === 'un'" class="embalagem">
        <label for="embalagem">
          Embalagem <span class="suave">(opcional{{ embalagemOrigem ? ` · ${embalagemOrigem}` : '' }})</span>
        </label>
        <input
          id="embalagem"
          v-model="embalagemTexto"
          placeholder="ex.: 800 g, 1 L, 12 un"
          autocomplete="off"
          :aria-invalid="embalagemInvalida"
        />
        <p v-if="embalagemInvalida" class="erro-campo">Não entendi: use um número e g, kg, ml, L ou un.</p>
      </div>

      <details :open="Boolean(inicial?.variante || inicial?.precoCheio)">
        <summary class="suave">Marca e promoção</summary>
        <label for="variante">Marca / variante</label>
        <input id="variante" v-model="variante" :placeholder="referencia?.variante ?? 'ex.: integral 1L'" />
        <label for="cheio">Preço sem promoção</label>
        <input id="cheio" v-model="precoCheioTexto" inputmode="decimal" placeholder="opcional" />
      </details>

      <p class="total">
        Total <strong class="num">{{ total === null ? '—' : formatarDinheiro(total) }}</strong>
        <span v-if="porConteudo" class="suave num">{{ porConteudo }}</span>
        <span v-if="variacaoTexto" class="selo" :class="variacaoClasse">{{ variacaoTexto }}</span>
        <SeloReduflacao :reduflacao="reduflacao" />
      </p>

      <div class="acoes">
        <button
          v-if="referencia && !inicial && (unidadeRef === un)"
          type="button"
          class="primario"
          :disabled="!podeSalvarMesmoPreco"
          @click="salvar(referencia.preco)"
        >
          ✓ Mesmo preço
        </button>
        <button type="submit" :class="{ primario: !referencia || inicial || unidadeRef !== un }" :disabled="!valido">
          {{ inicial ? 'Salvar' : 'Registrar' }}
        </button>
        <button v-if="inicial" type="button" class="perigo" @click="emit('remover')">Remover</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { DadosLinha, PrecoReferencia, Unidade } from '../../shared/types/api'
import type { Embalagem } from '../../shared/utils/embalagem'

const props = defineProps<{
  titulo: string
  unidade: Unidade
  /** Quantidade sugerida (da lista ou da última compra). */
  quantidade?: number | null
  /** Último preço do item neste mercado. */
  referencia?: PrecoReferencia | null
  /** Linha existente, ao corrigir. */
  inicial?: Omit<DadosLinha, 'categoriaId'> | null
  precisaCategoria?: boolean
  /** Embalagem habitual do item: sugestão quando não há compra anterior com embalagem. */
  embalagemHabitual?: Embalagem | null
}>()
const emit = defineEmits<{ salvar: [dados: DadosLinha]; remover: []; fechar: [] }>()

const un = ref<Unidade>(props.inicial?.unidade ?? props.unidade)
const unidadeRef = props.unidade
const qtdInicial = props.inicial?.quantidade ?? props.quantidade ?? (un.value === 'kg' ? null : 1)
const unidades = ref(un.value === 'un' ? Math.max(1, Math.round(qtdInicial ?? 1)) : 1)
const pesoTexto = ref(un.value === 'kg' && qtdInicial ? String(qtdInicial).replace('.', ',') : '')
const precoTexto = ref(dinheiroParaCampo(props.inicial?.precoUnitario))
const precoCheioTexto = ref(dinheiroParaCampo(props.inicial?.precoCheio))
const variante = ref(props.inicial?.variante ?? '')

// Embalagem: a da linha (ao corrigir), senão a da última compra aqui, senão a habitual.
const embalagemSugerida = props.inicial
  ? (props.inicial.embalagem ?? null)
  : (props.referencia?.embalagem ?? props.embalagemHabitual ?? null)
const embalagemOrigem = props.inicial
  ? ''
  : props.referencia?.embalagem
    ? 'a da última vez aqui'
    : props.embalagemHabitual
      ? 'a habitual'
      : ''
const embalagemTexto = ref(formatarEmbalagem(embalagemSugerida))
const embalagem = computed(() => (un.value === 'un' ? lerEmbalagem(embalagemTexto.value) : null))
const embalagemInvalida = computed(() => un.value === 'un' && Boolean(embalagemTexto.value.trim()) && !embalagem.value)
const categoriaId = ref<number | null>(null)
const campoPreco = ref<HTMLInputElement>()

const quantidadeAtual = computed(() => (un.value === 'kg' ? parseNumero(pesoTexto.value) : unidades.value))
const preco = computed(() => parseDinheiro(precoTexto.value))
const total = computed(() =>
  quantidadeAtual.value && preco.value !== null ? totalItem(quantidadeAtual.value, preco.value) : null,
)
const categoriaOk = computed(() => !props.precisaCategoria || categoriaId.value !== null)
const valido = computed(
  () =>
    Boolean(quantidadeAtual.value && quantidadeAtual.value > 0) &&
    preco.value !== null &&
    categoriaOk.value &&
    !embalagemInvalida.value,
)
const podeSalvarMesmoPreco = computed(
  () => Boolean(quantidadeAtual.value && quantidadeAtual.value > 0) && categoriaOk.value && !embalagemInvalida.value,
)

/** "R$ 22,50/kg" quando a embalagem é conhecida (exceto unidades de 1 un). */
const porConteudo = computed(() => {
  const e = embalagem.value
  if (!e || preco.value === null || (e.unidade === 'un' && e.qtd === 1)) return ''
  return `${formatarDinheiro(precoBase(preco.value, e))}${rotuloBase(baseDe(e.unidade))}`
})
const reduflacao = computed(() =>
  props.referencia && preco.value !== null && unidadeRef === un.value
    ? detectarReduflacao(props.referencia, { preco: preco.value, embalagem: embalagem.value })
    : null,
)

// Embalagens de tamanhos diferentes: compara o preço por kg/L/un.
const comparacao = computed(() => {
  const ref = props.referencia
  if (!ref || preco.value === null || !ref.preco || unidadeRef !== un.value) return null
  const e = embalagem.value
  if (e && ref.embalagem && mesmaBase(e, ref.embalagem) && !mesmoConteudo(e, ref.embalagem)) {
    const antes = precoBase(ref.preco, ref.embalagem)
    return { v: (precoBase(preco.value, e) - antes) / antes, sufixo: rotuloBase(baseDe(e.unidade)) }
  }
  return { v: (preco.value - ref.preco) / ref.preco, sufixo: '' }
})
const variacao = computed(() => comparacao.value?.v ?? null)
const variacaoTexto = computed(() => {
  const c = comparacao.value
  if (!c) return ''
  if (Math.abs(c.v) < 0.01) return c.sufixo ? `= preço${c.sufixo}` : '= preço'
  return `${c.v > 0 ? '▲' : '▼'} ${formatarPercentual(Math.abs(c.v))}${c.sufixo}`
})
const variacaoClasse = computed(() => {
  const v = variacao.value ?? 0
  return Math.abs(v) < 0.01 ? 'igual' : v > 0 ? 'sobe' : 'desce'
})

function dataCurta(dia: string) {
  const [, m, d] = dia.split('-')
  return `${d}/${m}`
}

function salvar(precoForcado?: number) {
  const precoFinal = precoForcado ?? preco.value
  if (precoFinal === null || !quantidadeAtual.value || !categoriaOk.value) return
  emit('salvar', {
    unidade: un.value,
    quantidade: Math.round(quantidadeAtual.value * 1000) / 1000,
    precoUnitario: precoFinal,
    precoCheio: parseDinheiro(precoCheioTexto.value),
    variante: variante.value.trim() || null,
    embalagem: embalagem.value,
    categoriaId: categoriaId.value,
  })
}

onMounted(() => {
  if (!props.referencia && !props.precisaCategoria) campoPreco.value?.focus()
})
</script>

<style scoped>
.fundo {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 35%);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 40;
}

.folha {
  background: var(--superficie);
  width: 100%;
  max-width: 40rem;
  max-height: 92vh;
  overflow-y: auto;
  border-radius: 1rem 1rem 0 0;
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
}

.folha h2 {
  margin: 0;
}

.unidade {
  margin-top: 0.75rem;
}

.campos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.qtd {
  text-align: center;
  padding-inline: 0.25rem;
}

details {
  margin-top: 0.75rem;
}

summary {
  cursor: pointer;
  padding: 0.25rem 0;
}

.embalagem {
  margin-top: 0.75rem;
}

.erro-campo {
  color: var(--perigo);
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
}

.total {
  flex-wrap: wrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  margin: 1rem 0 0.5rem;
}

.acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.acoes button {
  flex: 1;
}
</style>
