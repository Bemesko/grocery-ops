<template>
  <main class="pagina">
    <header class="cabecalho">
      <h1>Compras</h1>
      <div class="cabecalho-acoes">
        <NuxtLink to="/gastos" class="suave">Gastos do mês →</NuxtLink>
        <OlhoValores />
      </div>
    </header>
    <button type="button" class="botao" :disabled="lendo" @click="leitor = true">
      {{ lendo ? 'Lendo a nota…' : 'Adicionar pela nota fiscal' }}
    </button>
    <p v-if="carregado && !compras.length" class="vazio">Nenhuma compra finalizada ainda.</p>
    <ul v-else class="lista">
      <li v-for="c in compras" :key="c.id">
        <NuxtLink :to="`/compras/${c.id}`" class="linha cresce">
          <span class="cresce">
            <strong>{{ c.mercado }}</strong>
            <span class="suave"> · {{ dataCurta(c.data) }} · {{ c.itens }} itens</span>
            <span v-if="c.origem === 'importacao'" class="selo neutro">importada</span>
            <span v-else-if="c.origem === 'nfce'" class="selo neutro">pela nota</span>
          </span>
          <span class="num">{{ formatarDinheiro(c.total) }}</span>
        </NuxtLink>
      </li>
    </ul>

    <LeitorQr v-if="leitor" titulo="Adicionar compra pela nota" @lido="ler" @fechar="leitor = false" />

    <div v-if="escolha" class="fundo" @click.self="escolha = null">
      <form class="folha-mercado" @submit.prevent="criar">
        <h2>De qual mercado é esta nota?</h2>
        <p class="suave">
          {{ escolha.emitente }} · CNPJ {{ formatarCnpj(escolha.cnpj) }} · {{ formatarDinheiro(escolha.total) }}
        </p>
        <label for="mercado-nota">Mercado</label>
        <select id="mercado-nota" v-model="escolha.mercado">
          <option value="novo">Novo mercado</option>
          <option v-for="m in mercados" :key="m.id" :value="m.id">{{ m.nome }}</option>
        </select>
        <template v-if="escolha.mercado === 'novo'">
          <label for="nome-mercado">Nome do mercado novo</label>
          <input id="nome-mercado" v-model="escolha.nome" maxlength="60" />
        </template>
        <div class="linha acoes">
          <button type="button" @click="escolha = null">Cancelar</button>
          <button type="submit" class="primario" :disabled="lendo">Adicionar</button>
        </div>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { Compra, Mercado } from '../../../shared/types/api'

const compras = ref<(Compra & { itens: number })[]>([])
const carregado = ref(false)

onMounted(async () => {
  const r = await tentar(() => $fetch<(Compra & { itens: number })[]>('/api/compras?limite=200'))
  if (!r) return
  compras.value = r
  carregado.value = true
})

// Compra só pela nota: o servidor cria a compra no mercado do CNPJ da nota; se o CNPJ é
// novo, pergunta o mercado e a segunda chamada usa a nota já lida (sem nova consulta).
interface RespostaNovaPelaNota {
  resultado: 'ok' | 'verificacao' | 'limite' | 'erro' | 'escolher_mercado'
  mensagem?: string
  compraId?: number
  existente?: boolean
  emitente?: string
  cnpj?: string
  total?: number
}

const leitor = ref(false)
const lendo = ref(false)
const mercados = ref<Mercado[]>([])
const escolha = ref<{ url: string; emitente: string; cnpj: string; total: number; mercado: number | 'novo'; nome: string } | null>(
  null,
)

async function enviar(corpo: Record<string, unknown>) {
  lendo.value = true
  const r = await tentar(() => $fetch<RespostaNovaPelaNota>('/api/compras/nfce', { method: 'POST', body: corpo }))
  lendo.value = false
  return r
}

async function abrir(r: RespostaNovaPelaNota) {
  if (r.existente) avisar('Esta nota já estava registrada')
  await navigateTo(`/compras/${r.compraId}`)
}

async function ler(url: string) {
  leitor.value = false
  const r = await enviar({ url })
  if (!r) return
  if (r.resultado === 'ok') return abrir(r)
  if (r.resultado === 'escolher_mercado') {
    mercados.value = (await tentar(() => $fetch<Mercado[]>('/api/mercados'))) ?? []
    escolha.value = { url, emitente: r.emitente!, cnpj: r.cnpj!, total: r.total!, mercado: 'novo', nome: r.emitente! }
    return
  }
  avisar(r.mensagem ?? 'Não consegui ler a nota', 'erro')
}

async function criar() {
  const e = escolha.value
  if (!e) return
  const r = await enviar(e.mercado === 'novo' ? { url: e.url, mercadoNovo: e.nome } : { url: e.url, mercadoId: e.mercado })
  if (!r) return
  escolha.value = null
  if (r.resultado === 'ok') return abrir(r)
  avisar(r.mensagem ?? 'Não consegui ler a nota', 'erro')
}

function dataCurta(dia: string) {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.botao {
  margin-bottom: 0.75rem;
}

.fundo {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 35%);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 40;
}

.folha-mercado {
  background: var(--superficie);
  width: 100%;
  max-width: 40rem;
  border-radius: 1rem 1rem 0 0;
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
  display: grid;
  gap: 0.4rem;
}

.folha-mercado h2 {
  margin: 0;
}

.acoes {
  justify-content: flex-end;
  margin-top: 0.75rem;
}

a.linha {
  color: inherit;
  text-decoration: none;
}

.cresce {
  flex: 1;
  min-width: 0;
}
</style>
