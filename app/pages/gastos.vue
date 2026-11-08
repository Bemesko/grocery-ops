<template>
  <main class="pagina">
    <header class="cabecalho">
      <h1>Gastos</h1>
      <div class="cabecalho-acoes">
        <NuxtLink to="/compras" class="suave">Compras →</NuxtLink>
        <OlhoValores />
      </div>
    </header>

    <div class="chips modo" role="radiogroup" aria-label="Período">
      <button type="button" class="chip" :class="{ ativo: tipo === 'mes' }" role="radio" :aria-checked="tipo === 'mes'" @click="trocarTipo('mes')">
        Mês
      </button>
      <button
        type="button"
        class="chip"
        :class="{ ativo: tipo === 'trimestre' }"
        role="radio"
        :aria-checked="tipo === 'trimestre'"
        @click="trocarTipo('trimestre')"
      >
        Trimestre
      </button>
    </div>

    <div class="meses linha">
      <button type="button" class="icone" aria-label="Período anterior" :disabled="!anterior" @click="ir(anterior)">‹</button>
      <strong class="cresce mes">{{ nomePeriodo(periodo) }}</strong>
      <button type="button" class="icone" aria-label="Próximo período" :disabled="!proximo" @click="ir(proximo)">›</button>
    </div>

    <template v-if="g">
      <p v-if="!g.compras && !g.semanas?.some((s) => s.budget !== null)" class="vazio">
        Nenhuma compra {{ g.tipo === 'mes' ? 'neste mês' : 'neste trimestre' }}.<br />
        <NuxtLink to="/ajustes#importar">Importar histórico</NuxtLink>
      </p>
      <template v-else>
        <div class="cartao totais">
          <div>
            <span class="suave">Total</span>
            <strong class="num grande">{{ formatarDinheiro(g.total) }}</strong>
          </div>
          <div v-if="g.tipo === 'trimestre'">
            <span class="suave">Média/mês</span>
            <strong class="num grande">{{ formatarDinheiro(mediaMensal) }}</strong>
          </div>
          <div>
            <span class="suave">Compras</span>
            <strong class="num grande">{{ g.compras }}</strong>
          </div>
          <div v-if="g.foraDaLista.conhecido">
            <span class="suave">Fora da lista</span>
            <strong class="num grande">{{ formatarPercentual(g.foraDaLista.total / g.foraDaLista.conhecido) }}</strong>
          </div>
        </div>

        <template v-if="g.tipo === 'trimestre'">
          <h2>Mês a mês</h2>
          <ul class="lista">
            <li v-for="m in g.porMes" :key="m.mes">
              <a href="#" class="barra-linha" @click.prevent="abrirMes(m.mes)">
                <span class="linha">
                  <span class="cresce">{{ nomeMesCurto(m.mes) }}</span>
                  <span class="num">{{ formatarDinheiro(m.total) }}</span>
                </span>
                <span class="barra"><span :style="{ width: `${(m.total / maiorMes) * 100}%` }" /></span>
              </a>
            </li>
          </ul>
        </template>

        <template v-if="g.semanas?.length">
          <h2>Semana a semana</h2>
          <div v-if="temBudget" class="cartao">
            <GraficoAcumulado :semanas="g.semanas" />
          </div>
          <ul class="lista semanas">
            <li v-for="s in g.semanas" :key="s.segunda" :class="s.situacao">
              <div class="barra-linha">
                <span class="linha">
                  <span class="cresce">
                    {{ diaMes(s.segunda) }}–{{ diaMes(somarDias(s.segunda, 6)) }}
                    <span class="suave detalhe">
                      <template v-if="s.atrasada">· ida atrasada (era {{ diaSemanaCurto(s.diaPreferido) }} {{ diaMes(s.diaPreferido) }})</template>
                      <template v-else>· ida {{ diaSemanaCurto(s.diaPreferido) }} {{ diaMes(s.diaPreferido) }}</template>
                      <template v-if="s.situacao === 'atual'"> · agora</template>
                      <br />compras de {{ diaMes(s.inicio) }} a {{ diaMes(s.fim) }}
                    </span>
                  </span>
                  <span class="num">
                    {{ s.situacao === 'futura' ? '—' : formatarDinheiro(s.gasto) }}
                    <span v-if="s.budget !== null" class="suave">/ {{ formatarDinheiro(s.budget) }}</span>
                  </span>
                </span>
                <span class="barra comparada" :class="{ estourou: s.budget !== null && s.gasto > s.budget }">
                  <span :style="{ width: `${(s.gasto / maiorSemana) * 100}%` }" />
                  <i
                    v-if="s.budget !== null"
                    class="limite"
                    :style="{ left: `${(s.budget / maiorSemana) * 100}%` }"
                    aria-hidden="true"
                  />
                </span>
                <span v-if="s.budget !== null && s.situacao !== 'futura'" class="diferenca" :class="s.gasto > s.budget ? 'sobe' : 'desce'">
                  {{ s.gasto > s.budget ? `+${formatarDinheiro(s.gasto - s.budget)} acima` : `${formatarDinheiro(s.budget - s.gasto)} abaixo` }}
                  do budget
                </span>
              </div>
            </li>
          </ul>
          <p v-if="!temBudget" class="suave">
            Sem ajuste de saldo neste mês: só o gasto. O budget aparece a partir de um
            <NuxtLink to="/ajustes#saldo">ajuste de saldo</NuxtLink> no mês.
          </p>
        </template>

        <template v-if="g.compras">
          <h2>O que mais pesou</h2>
          <ul class="lista">
            <li v-for="(i, n) in g.topItens" :key="i.itemId">
              <NuxtLink :to="`/itens/${i.itemId}`" class="barra-linha">
                <span class="linha">
                  <span class="cresce">{{ n + 1 }}. {{ i.nome }}</span>
                  <span class="suave num">{{ formatarQuantidade(i.quantidade, i.unidade) }}</span>
                  <span class="num">{{ formatarDinheiro(i.total) }}</span>
                </span>
                <span class="barra"><span :style="{ width: `${(i.total / maiorItem) * 100}%` }" /></span>
              </NuxtLink>
            </li>
          </ul>

          <h2>Por categoria</h2>
          <p class="suave dica">Toque numa categoria para ver os itens dela.</p>
          <ul class="lista">
            <li v-for="c in g.porCategoria" :key="c.categoriaId" class="categoria">
              <button
                type="button"
                class="barra-linha abrir"
                :aria-expanded="aberta === c.categoriaId"
                @click="aberta = aberta === c.categoriaId ? null : c.categoriaId"
              >
                <span class="linha">
                  <span class="cresce">{{ aberta === c.categoriaId ? '▾' : '▸' }} {{ c.categoria }}</span>
                  <span class="suave num">{{ formatarPercentual(c.total / g.total) }}</span>
                  <span class="num">{{ formatarDinheiro(c.total) }}</span>
                </span>
                <span class="barra"><span :style="{ width: `${(c.total / maiorCategoria) * 100}%` }" /></span>
              </button>
              <ul v-if="aberta === c.categoriaId" class="itens-categoria">
                <li v-for="i in c.itens" :key="i.itemId">
                  <NuxtLink :to="`/itens/${i.itemId}`" class="barra-linha">
                    <span class="linha">
                      <span class="cresce">{{ i.nome }}</span>
                      <span class="suave num">{{ formatarQuantidade(i.quantidade, i.unidade) }}</span>
                      <span class="suave num">{{ formatarPercentual(i.total / c.total) }}</span>
                      <span class="num">{{ formatarDinheiro(i.total) }}</span>
                    </span>
                    <span class="barra fina"><span :style="{ width: `${(i.total / (c.itens[0]?.total || 1)) * 100}%` }" /></span>
                  </NuxtLink>
                </li>
              </ul>
            </li>
          </ul>

          <template v-if="g.porMercado.length > 1">
            <h2>Por mercado</h2>
            <ul class="lista">
              <li v-for="m in g.porMercado" :key="m.mercado">
                <span class="cresce">{{ m.mercado }}</span>
                <span class="suave num">{{ formatarPercentual(m.total / g.total) }}</span>
                <span class="num">{{ formatarDinheiro(m.total) }}</span>
              </li>
            </ul>
          </template>
        </template>
      </template>
    </template>
  </main>
</template>

<script setup lang="ts">
import type { Gastos } from '../../shared/types/api'

const rota = useRoute()
const g = ref<Gastos | null>(null)
const consultaInicial = typeof rota.query.periodo === 'string' ? rota.query.periodo : typeof rota.query.mes === 'string' ? rota.query.mes : ''
const periodo = ref(consultaInicial)
const tipo = computed<Gastos['tipo']>(() => (/-T\d$/.test(periodo.value) ? 'trimestre' : 'mes'))
const aberta = ref<number | null>(null)

async function carregar() {
  const r = await tentar(() => $fetch<Gastos>('/api/gastos', { query: periodo.value ? { periodo: periodo.value } : {} }))
  if (r) {
    g.value = r
    periodo.value = r.periodo
  }
}
onMounted(carregar)

const mesAtual = () => hojeSP().slice(0, 7)
const trimestreDe = (mes: string) => `${mes.slice(0, 4)}-T${Math.ceil(Number(mes.slice(5, 7)) / 3)}`

function somarMes(m: string, n: number) {
  const [a, mm] = m.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(a, mm - 1 + n, 1)).toISOString().slice(0, 7)
}
function somarTrimestre(t: string, n: number) {
  const ano = Number(t.slice(0, 4))
  const indice = ano * 4 + Number(t.slice(-1)) - 1 + n
  return `${Math.floor(indice / 4)}-T${(indice % 4) + 1}`
}

// Navega até o período mais antigo com compras e até o atual.
const anterior = computed(() => {
  if (!g.value) return ''
  const antigo = g.value.meses.at(-1)
  if (!antigo) return ''
  if (tipo.value === 'mes') return antigo < periodo.value ? somarMes(periodo.value, -1) : ''
  return trimestreDe(antigo) < periodo.value ? somarTrimestre(periodo.value, -1) : ''
})
const proximo = computed(() => {
  if (!periodo.value) return ''
  if (tipo.value === 'mes') return periodo.value < mesAtual() ? somarMes(periodo.value, 1) : ''
  return periodo.value < trimestreDe(mesAtual()) ? somarTrimestre(periodo.value, 1) : ''
})

function ir(p: string) {
  if (!p) return
  periodo.value = p
  aberta.value = null
  navigateTo({ query: { periodo: p } }, { replace: true })
  carregar()
}

function trocarTipo(novo: Gastos['tipo']) {
  if (novo === tipo.value || !g.value) return
  // Mês → trimestre que o contém; trimestre → mês atual se ele está no trimestre, senão o último.
  if (novo === 'trimestre') ir(trimestreDe(periodo.value))
  else {
    const ultimo = g.value.porMes.at(-1)!.mes
    ir(trimestreDe(mesAtual()) === periodo.value ? mesAtual() : ultimo)
  }
}

function abrirMes(mes: string) {
  ir(mes)
}

function nomeMes(m: string) {
  const [a, mm] = m.split('-').map(Number) as [number, number]
  const nome = new Date(a, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}
function nomeMesCurto(m: string) {
  const [a, mm] = m.split('-').map(Number) as [number, number]
  const nome = new Date(a, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}
function nomePeriodo(p: string) {
  if (!p) return ''
  const t = /^(\d{4})-T(\d)$/.exec(p)
  if (!t) return nomeMes(p)
  const n = Number(t[2])
  const meses = [n * 3 - 2, n * 3].map((m) =>
    new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
  )
  return `${n}º trimestre de ${t[1]} (${meses[0]}–${meses[1]})`
}
function diaMes(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
}
function diaSemanaCurto(dia: string) {
  return NOMES_DIAS[diaDaSemana(dia)]!.slice(0, 3)
}

const mediaMensal = computed(() => {
  const meses = g.value?.porMes.filter((m) => m.mes <= mesAtual()) ?? []
  return meses.length ? Math.round(g.value!.total / meses.length) : 0
})
const temBudget = computed(() => Boolean(g.value?.semanas?.some((s) => s.budget !== null)))
const maiorItem = computed(() => Math.max(1, ...(g.value?.topItens.map((i) => i.total) ?? [])))
const maiorCategoria = computed(() => Math.max(1, ...(g.value?.porCategoria.map((c) => c.total) ?? [])))
const maiorMes = computed(() => Math.max(1, ...(g.value?.porMes.map((m) => m.total) ?? [])))
const maiorSemana = computed(() =>
  Math.max(1, ...(g.value?.semanas?.flatMap((s) => [s.gasto, s.budget ?? 0]) ?? [])) * 1.05,
)
</script>

<style scoped>
.modo {
  justify-content: center;
  margin-bottom: 0.5rem;
}

.meses {
  margin-bottom: 0.75rem;
}

.mes {
  text-align: center;
}

.totais {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
  gap: 0.75rem;
}

.totais div {
  display: grid;
}

.grande {
  font-size: 1.35rem;
}

.cresce {
  flex: 1;
  min-width: 0;
}

.barra-linha {
  display: grid;
  gap: 0.3rem;
  width: 100%;
  color: inherit;
  text-decoration: none;
}

button.abrir {
  justify-content: stretch;
  border: 0;
  background: none;
  padding: 0;
  text-align: left;
  min-height: auto;
  font: inherit;
  color: inherit;
}

.lista > li.categoria {
  display: grid;
}

.itens-categoria {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0 0 0 1rem;
  display: grid;
  gap: 0.5rem;
  border-left: 2px solid var(--borda);
}

.barra.fina {
  height: 0.35rem;
}

.detalhe {
  font-size: 0.8rem;
}

.dica {
  margin: -0.25rem 0 0.5rem;
  font-size: 0.8rem;
}

.semanas li.futura {
  opacity: 0.6;
}

.semanas li.atual {
  box-shadow: inset 3px 0 0 var(--primaria);
}

.barra.comparada {
  position: relative;
  overflow: visible;
}

.barra.comparada.estourou > span {
  background: var(--sobe);
}

.limite {
  position: absolute;
  top: -0.2rem;
  bottom: -0.2rem;
  width: 2px;
  margin-left: -1px;
  background: var(--texto);
  border-radius: 1px;
}

.diferenca {
  font-size: 0.8rem;
}

.diferenca.sobe {
  color: var(--sobe);
}

.diferenca.desce {
  color: var(--desce);
}
</style>
