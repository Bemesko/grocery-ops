<!--
  Gasto acumulado × budget acumulado ao longo das semanas do mês. Duas linhas no mesmo
  eixo (R$): gasto (cheia, verde) até a semana atual e budget (tracejada, cinza) até o fim.
  Identidade por cor e por traço, com legenda e rótulo direto no fim de cada linha.
-->
<template>
  <figure class="grafico">
    <svg :viewBox="`0 0 ${L} ${A}`" role="img" :aria-label="descricao">
      <line :x1="M" :x2="L - D" :y1="y(0)" :y2="y(0)" class="eixo" />
      <polyline :points="pontos(budgetAcum)" class="budget" />
      <polyline v-if="gastoAcum.length" :points="pontos(gastoAcum)" class="gasto" />
      <g v-for="(s, i) in semanas" :key="s.segunda">
        <circle v-if="budgetAcum[i] !== undefined" :cx="x(i)" :cy="y(budgetAcum[i]!)" r="4" class="ponto-budget">
          <title>{{ rotulo(s) }} · budget acumulado {{ formatarDinheiro(budgetAcum[i]) }}</title>
        </circle>
        <circle v-if="gastoAcum[i] !== undefined" :cx="x(i)" :cy="y(gastoAcum[i]!)" r="4" class="ponto-gasto">
          <title>{{ rotulo(s) }} · gasto acumulado {{ formatarDinheiro(gastoAcum[i]) }}</title>
        </circle>
        <text :x="x(i)" :y="A - 4" class="eixo-texto" text-anchor="middle">{{ rotuloCurto(s) }}</text>
      </g>
    </svg>
    <figcaption class="legenda">
      <span><i class="chave gasto" /> Gasto acumulado <strong class="num">{{ formatarDinheiro(gastoAcum.at(-1) ?? 0) }}</strong></span>
      <span><i class="chave budget" /> Budget acumulado <strong class="num">{{ formatarDinheiro(budgetAcum.at(-1) ?? 0) }}</strong></span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import type { SemanaEvolucao } from '../../shared/utils/budget'

const props = defineProps<{ semanas: SemanaEvolucao[] }>()

const L = 320
const A = 130
const M = 14 // margem esquerda/direita para os pontos
const D = 14
const TOPO = 10
const BASE = 22 // espaço dos rótulos do eixo x

const acumular = (valores: number[]) => valores.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], [])
const budgetAcum = computed(() => acumular(props.semanas.map((s) => s.budget ?? 0)))
const gastoAcum = computed(() => acumular(props.semanas.filter((s) => s.situacao !== 'futura').map((s) => s.gasto)))
const maximo = computed(() => Math.max(1, ...budgetAcum.value, ...gastoAcum.value))

const x = (i: number) => M + (i * (L - M - D)) / Math.max(1, props.semanas.length - 1)
const y = (v: number) => TOPO + (1 - v / maximo.value) * (A - TOPO - BASE)
const pontos = (valores: number[]) => valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')

function rotulo(s: SemanaEvolucao) {
  return `Semana de ${s.segunda.slice(8, 10)}/${s.segunda.slice(5, 7)}`
}
function rotuloCurto(s: SemanaEvolucao) {
  return `${s.segunda.slice(8, 10)}/${s.segunda.slice(5, 7)}`
}

const descricao = computed(
  () =>
    `Gasto acumulado ${formatarDinheiro(gastoAcum.value.at(-1) ?? 0)} contra budget acumulado ` +
    `${formatarDinheiro(budgetAcum.value.at(-1) ?? 0)} em ${props.semanas.length} semanas`,
)
</script>

<style scoped>
.grafico {
  margin: 0;
}

svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.eixo {
  stroke: var(--borda);
  stroke-width: 1;
}

.eixo-texto {
  fill: var(--texto-suave);
  font-size: 10px;
}

polyline {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.gasto {
  stroke: var(--primaria);
}

.budget {
  stroke: var(--texto-suave);
  stroke-dasharray: 4 4;
}

circle {
  stroke: var(--superficie);
  stroke-width: 2;
}

.ponto-gasto {
  fill: var(--primaria);
}

.ponto-budget {
  fill: var(--texto-suave);
}

.legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-size: 0.8rem;
  color: var(--texto-suave);
  margin-top: 0.35rem;
}

.chave {
  display: inline-block;
  width: 1rem;
  height: 0;
  vertical-align: middle;
  margin-right: 0.25rem;
  border-top: 2px solid var(--primaria);
}

.chave.budget {
  border-top: 2px dashed var(--texto-suave);
}
</style>
