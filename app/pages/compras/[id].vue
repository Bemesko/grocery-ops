<template>
  <main class="pagina">
    <header class="cabecalho">
      <NuxtLink to="/compras" class="suave">← Compras</NuxtLink>
      <OlhoValores />
    </header>

    <template v-if="r">
      <h1>{{ r.compra.mercado }} · {{ dataLonga(r.compra.data) }}</h1>
      <p class="suave">
        {{ r.itens.length }} itens
        <template v-if="r.compra.origem === 'importacao'"> · importada</template>
        <template v-else-if="r.compra.origem === 'nfce'"> · pela nota fiscal</template>
      </p>

      <div class="cartao destaque">
        <div class="linha">
          <span class="cresce">Total</span>
          <strong class="num grande">{{ formatarDinheiro(r.compra.total) }}</strong>
        </div>
        <div v-if="r.divergencia !== null" class="linha suave">
          <span class="cresce">Nota: {{ formatarDinheiro(r.compra.totalNota) }}</span>
          <span :class="Math.abs(r.divergencia) <= 0.05 ? 'ok' : 'ruim'">
            {{ r.divergencia >= 0 ? '+' : '' }}{{ formatarPercentual(r.divergencia, 1) }}
            {{ Math.abs(r.divergencia) <= 0.05 ? '✓' : '— confira' }}
          </span>
        </div>
        <div v-if="projecao" class="linha suave">
          <span class="cresce">Budget da semana</span>
          <span :class="projecao.restante < 0 ? 'ruim' : 'ok'" class="num">
            {{ projecao.restante < 0 ? 'passou' : 'sobrou' }} {{ formatarDinheiro(Math.abs(projecao.restante)) }}
          </span>
        </div>
        <p v-if="projecao && projecao.restante < 0 && projecao.proximasSemanas !== null" class="aviso alerta">
          Próximas semanas: {{ formatarDinheiro(projecao.proximasSemanas) }} cada
          (era {{ formatarDinheiro(projecao.semanalNormal) }}).
        </p>
      </div>

      <ConferenciaNota :compra-id="id" :anotados="r.itens" @mudou="carregar" />

      <template v-if="r.topItens.length">
        <h2>O que mais pesou</h2>
        <ul class="lista">
          <li v-for="i in r.topItens" :key="i.id">
            <span class="cresce">{{ i.nome }}</span>
            <span class="suave num">{{ formatarPercentual(i.total / Math.max(1, r.compra.total)) }}</span>
            <span class="num">{{ formatarDinheiro(i.total) }}</span>
          </li>
        </ul>
      </template>

      <template v-if="r.foraDaLista.quantidade">
        <h2>Fora da lista</h2>
        <p class="aviso alerta">
          {{ r.foraDaLista.quantidade }} {{ r.foraDaLista.quantidade === 1 ? 'item' : 'itens' }} que não estavam na lista:
          <strong class="num">{{ formatarDinheiro(r.foraDaLista.total) }}</strong>
          ({{ formatarPercentual(r.foraDaLista.total / Math.max(1, r.compra.total)) }} da compra)
        </p>
      </template>

      <template v-if="r.altas.length || r.baixas.length">
        <h2>Preços que mudaram</h2>
        <ul class="lista">
          <li v-for="i in [...r.altas, ...r.baixas]" :key="i.id">
            <span class="cresce">
              {{ i.nome }}
              <SeloVariacao :variacao="i.variacao" class="selos-linha" />
            </span>
            <span class="suave num">{{ formatarDinheiro(i.variacao!.anterior) }}{{ i.variacao!.porConteudo }} →</span>
            <span class="num">{{ formatarDinheiro(precoComparado(i)) }}{{ i.variacao!.porConteudo }}</span>
          </li>
        </ul>
      </template>

      <h2>Itens</h2>
      <p class="suave">Toque num item para corrigir preço ou quantidade.</p>
      <ul class="lista">
        <li v-for="i in r.itens" :key="i.id" class="clicavel" @click="editar(i)">
          <span class="cresce">
            {{ i.nome }}
            <span class="suave">
              · {{ formatarQuantidade(i.quantidade, i.unidade) }}<template v-if="i.embalagem"> de {{ formatarEmbalagem(i.embalagem) }}</template> × {{ formatarDinheiro(i.precoUnitario) }}
              <template v-if="i.variante"> · {{ i.variante }}</template>
            </span>
            <span v-if="i.daLista === false" class="selo neutro">fora da lista</span>
          </span>
          <span class="num">{{ formatarDinheiro(i.total) }}</span>
        </li>
      </ul>

      <h2>Total da nota</h2>
      <form class="linha" @submit.prevent="salvarNota">
        <input v-model="notaTexto" class="cresce" inputmode="decimal" placeholder="0,00" />
        <button type="submit">Salvar</button>
      </form>

      <button v-if="r.compra.status !== 'em_andamento'" type="button" class="botao excluir" @click="excluir">
        Excluir compra
      </button>

      <FolhaPreco
        v-if="editando"
        :key="editando.id"
        :titulo="editando.nome"
        :unidade="editando.unidade"
        :inicial="editando"
        @fechar="editando = null"
        @salvar="salvarLinha"
        @remover="removerLinha"
      />
    </template>
  </main>
</template>

<script setup lang="ts">
import type { CompraItem, DadosLinha, ResumoCompra } from '../../../shared/types/api'

const rota = useRoute()
const id = Number(rota.params.id)
const r = ref<ResumoCompra | null>(null)
const editando = ref<CompraItem | null>(null)
const notaTexto = ref('')

async function carregar() {
  const resposta = await tentar(() => $fetch<ResumoCompra>(`/api/compras/${id}`))
  if (resposta) {
    r.value = resposta
    notaTexto.value = dinheiroParaCampo(resposta.compra.totalNota)
  }
}
onMounted(carregar)

const projecao = computed(() => (r.value?.budget ? projetarBudget(r.value.budget) : null))

function dataLonga(dia: string) {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function editar(i: CompraItem) {
  editando.value = i
}

async function salvarLinha(d: DadosLinha) {
  const linha = editando.value
  if (!linha) return
  const { categoriaId: _c, ...corpo } = d
  const ok = await tentar(() => $fetch(`/api/compras/${id}/itens/${linha.id}`, { method: 'PATCH', body: corpo }))
  if (!ok) return
  editando.value = null
  await carregar()
}

async function removerLinha() {
  const linha = editando.value
  if (!linha || !confirm(`Tirar ${linha.nome} desta compra?`)) return
  await tentar(() => $fetch(`/api/compras/${id}/itens/${linha.id}`, { method: 'DELETE' }))
  editando.value = null
  await carregar()
}

async function salvarNota() {
  const totalNota = parseDinheiro(notaTexto.value)
  const resposta = await tentar(() =>
    $fetch<ResumoCompra>(`/api/compras/${id}`, { method: 'PATCH', body: { totalNota } }),
  )
  if (resposta) {
    r.value = resposta
    avisar('Total da nota salvo')
  }
}

async function excluir() {
  const c = r.value?.compra
  if (!c) return
  const quando = new Date(`${c.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  if (!confirm(`Excluir a compra de ${c.mercado} em ${quando}? Os itens e a nota dela somem; a lista não muda. Não dá para desfazer.`)) {
    return
  }
  const ok = await tentar(() => $fetch(`/api/compras/${id}`, { method: 'DELETE' }))
  if (!ok) return
  avisar('Compra excluída')
  await navigateTo('/compras', { replace: true })
}

/** Preço atual na mesma base da variação: por kg/L/un quando as embalagens diferem. */
function precoComparado(i: CompraItem) {
  return i.variacao?.porConteudo && i.embalagem ? precoBase(i.precoUnitario, i.embalagem) : i.precoUnitario
}
</script>

<style scoped>
h1 {
  font-size: 1.25rem;
}

.destaque {
  display: grid;
  gap: 0.35rem;
}

.grande {
  font-size: 1.5rem;
}

.cresce {
  flex: 1;
  min-width: 0;
}

.clicavel {
  cursor: pointer;
}
.excluir {
  margin-top: 2rem;
  width: 100%;
  color: var(--perigo);
}

.selos-linha {
  margin-top: 0.2rem;
}
</style>
