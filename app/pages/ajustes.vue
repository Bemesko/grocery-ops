<template>
  <main class="pagina">
    <header class="cabecalho">
      <h1>Ajustes</h1>
      <OlhoValores />
    </header>

    <!-- Saldo do VR -->
    <section id="saldo">
      <h2>Saldo do VR</h2>
      <div class="cartao">
        <template v-if="saldo?.budget.configurado && projecao">
          <div class="linha">
            <span class="cresce">Saldo agora</span>
            <strong class="num">{{ formatarDinheiro(saldo.budget.saldo) }}</strong>
          </div>
          <div class="linha suave">
            <span class="cresce">
              Semana de {{ diaCurto(saldo.budget.semana) }} · compras de {{ diaCurto(saldo.budget.inicio) }} a
              {{ diaCurto(saldo.budget.fim) }}
            </span>
            <span class="num">{{ formatarDinheiro(projecao.budget) }}</span>
          </div>
          <div class="linha suave">
            <span class="cresce">Gasto na semana</span>
            <span class="num">{{ formatarDinheiro(saldo.budget.gastoPeriodo) }}</span>
          </div>
          <div v-if="projecao.proximasSemanas !== null" class="linha suave">
            <span class="cresce">
              {{ projecao.semanasDepois === 1 ? 'Semana seguinte' : `Próximas ${projecao.semanasDepois} semanas` }}
              (até a recarga)
            </span>
            <span class="num">{{ formatarDinheiro(projecao.proximasSemanas) }}{{ projecao.semanasDepois > 1 ? ' cada' : '' }}</span>
          </div>
          <p v-else class="suave">Última semana do ciclo: o que sobrar passa para o próximo mês.</p>
        </template>
        <p v-else class="suave">
          Informe o saldo somado dos VRs. O budget da semana é o saldo dividido pelas semanas que faltam até a
          recarga do dia 1.
        </p>
        <form class="linha ajuste" @submit.prevent="ajustarSaldo">
          <input v-model="saldoTexto" class="cresce" inputmode="decimal" placeholder="Saldo de hoje (R$)" />
          <button type="submit" class="primario" :disabled="parseDinheiro(saldoTexto) === null">Ajustar</button>
        </form>
        <p class="suave dica">
          Ajuste quando quiser (depois da recarga, ou ao conferir o app do VR): os budgets são recalculados
          na hora, e o que a semana já gastou continua contando nela.
        </p>
        <label for="dia-preferido">Dia de ir ao mercado</label>
        <select id="dia-preferido" :value="diaPreferidoAtual" @change="mudarDiaPreferido(($event.target as HTMLSelectElement).value)">
          <option v-for="(nome, i) in NOMES_DIAS" :key="nome" :value="i">{{ nome }}</option>
        </select>
        <p class="suave dica">
          Compras de segunda e terça contam para a semana corrente; de quarta a domingo, para a seguinte. Cada
          semana sai do saldo do mês em que cai o dia de ir ao mercado.
        </p>
        <details v-if="saldo?.ajustes.length">
          <summary class="suave">Ajustes anteriores</summary>
          <ul class="simples">
            <li v-for="a in saldo.ajustes" :key="a.id" class="linha">
              <span class="cresce suave">{{ new Date(a.em).toLocaleString('pt-BR') }}</span>
              <span class="num">{{ formatarDinheiro(a.saldo) }}</span>
            </li>
          </ul>
        </details>
      </div>
    </section>

    <!-- Mercados -->
    <section id="mercados">
      <h2>Mercados</h2>
      <ul class="lista">
        <li v-for="m in mercados" :key="m.id">
          <input class="cresce" :value="m.nome" @change="renomearMercado(m, ($event.target as HTMLInputElement).value)" />
          <select :value="m.tipo" class="tipo" @change="mudarTipo(m, ($event.target as HTMLSelectElement).value)">
            <option value="varejo">Varejo</option>
            <option value="atacado">Atacado</option>
          </select>
          <button type="button" class="icone" aria-label="Apagar mercado" @click="apagarMercado(m)">🗑</button>
        </li>
      </ul>
      <form class="linha novo" @submit.prevent="criarMercado">
        <input v-model="novoMercado" class="cresce" placeholder="Novo mercado" />
        <select v-model="novoTipo" class="tipo">
          <option value="varejo">Varejo</option>
          <option value="atacado">Atacado</option>
        </select>
        <button type="submit" :disabled="!novoMercado.trim()">Adicionar</button>
      </form>
    </section>

    <!-- Categorias -->
    <section id="categorias">
      <h2>Categorias</h2>
      <p class="suave">Na ordem dos corredores. Ela organiza a lista e as compras.</p>
      <ul class="lista">
        <li v-for="(c, i) in categorias" :key="c.id">
          <div class="setas">
            <button type="button" class="icone" :disabled="i === 0" aria-label="Subir" @click="mover(i, -1)">↑</button>
            <button type="button" class="icone" :disabled="i === categorias.length - 1" aria-label="Descer" @click="mover(i, 1)">↓</button>
          </div>
          <input class="cresce" :value="c.nome" @change="renomearCategoria(c, ($event.target as HTMLInputElement).value)" />
          <span class="suave num">{{ c.itens }}</span>
          <button type="button" class="icone" aria-label="Apagar categoria" :disabled="Boolean(c.itens)" @click="apagarCategoria(c)">🗑</button>
        </li>
      </ul>
      <form class="linha novo" @submit.prevent="criarCategoria">
        <input v-model="novaCategoria" class="cresce" placeholder="Nova categoria" />
        <button type="submit" :disabled="!novaCategoria.trim()">Adicionar</button>
      </form>
    </section>

    <!-- Itens -->
    <section id="itens">
      <h2>Itens</h2>
      <p class="suave">Mudar categorias em lote, juntar duplicados e ajustar embalagens.</p>
      <NuxtLink to="/itens" class="botao">Gerenciar itens ({{ itens.length }})</NuxtLink>
    </section>

    <!-- Alexa -->
    <section id="alexa">
      <h2>Lista da Alexa</h2>
      <p v-if="!alexa?.ligada" class="suave">
        Desligada. Para ligar, o servidor precisa de HA_URL, HA_TOKEN e HA_TODO_ENTITY (Secret grocery-ops-alexa).
      </p>
      <template v-else>
        <p class="suave">
          O que é pedido para a Alexa entra na lista (itens novos em "Outros") e sai como concluído na lista da Alexa.
          O app confere a cada minuto e ao abrir.
        </p>
        <p v-if="alexa.erro" class="aviso alerta">Última tentativa falhou: {{ alexa.erro }}</p>
        <p v-else-if="alexa.ultimaEm" class="suave">Última sincronização: {{ horaCurta(alexa.ultimaEm) }}</p>
        <button type="button" class="botao" :disabled="sincronizando" @click="sincronizarAlexa">Sincronizar agora</button>
      </template>
    </section>

    <!-- Importação -->
    <section id="importar">
      <h2>Importar histórico (CSV)</h2>
      <p class="suave">
        Colunas: data, mercado, item, categoria, unidade, quantidade, preco_unitario e, opcionais, variante,
        preco_cheio, da_lista, total_nota, compra, embalagem (ex.: 800 g). Separador vírgula ou ponto e vírgula.
      </p>
      <input type="file" accept=".csv,text/csv" @change="lerArquivo" />
      <div v-if="previa" class="cartao previa">
        <p>
          <strong>{{ arquivo }}</strong>: {{ previa.totalLinhas }} linhas válidas em {{ previa.compras.length }} compras
        </p>
        <p v-if="previa.mercadosNovos.length" class="suave">Mercados novos: {{ previa.mercadosNovos.join(', ') }}</p>
        <p v-if="previa.itensNovos.length" class="suave">
          {{ previa.itensNovos.length }} itens novos: {{ previa.itensNovos.slice(0, 15).join(', ') }}{{ previa.itensNovos.length > 15 ? '…' : '' }}
        </p>
        <ul class="simples">
          <li v-for="c in previa.compras" :key="c.chave" class="linha">
            <span class="cresce">{{ c.data }} · {{ c.mercado }} · {{ c.itens }} itens</span>
            <span class="num">{{ formatarDinheiro(c.total) }}</span>
            <span v-if="c.totalNota" class="suave num">(nota {{ formatarDinheiro(c.totalNota) }})</span>
          </li>
        </ul>
        <div v-if="previa.erros.length" class="aviso perigo">
          <p><strong>{{ previa.erros.length }} linhas com erro.</strong> Corrija o arquivo e envie de novo:</p>
          <ul>
            <li v-for="e in previa.erros.slice(0, 20)" :key="e.linha">Linha {{ e.linha }}: {{ e.mensagem }}</li>
          </ul>
        </div>
        <div class="linha acoes">
          <button type="button" @click="previa = null">Cancelar</button>
          <button type="button" class="primario" :disabled="Boolean(previa.erros.length) || !previa.totalLinhas" @click="confirmarImportacao">
            Importar
          </button>
        </div>
      </div>
      <template v-if="importacoes.length">
        <h3>Importações</h3>
        <ul class="lista">
          <li v-for="imp in importacoes" :key="imp.id">
            <span class="cresce">
              {{ imp.arquivo }}
              <span class="suave">· {{ new Date(imp.criadaEm).toLocaleDateString('pt-BR') }} · {{ imp.compras }} compras</span>
            </span>
            <span class="num">{{ formatarDinheiro(imp.total) }}</span>
            <button type="button" class="texto" @click="desfazer(imp)">Desfazer</button>
          </li>
        </ul>
      </template>
    </section>

    <p class="suave versao">versão {{ versao }}</p>
  </main>
</template>

<script setup lang="ts">
import type { Categoria, Configuracao, EstadoAlexa, Mercado } from '../../shared/types/api'
import type { BaseBudget } from '../../shared/utils/budget'

interface Saldo {
  budget: BaseBudget
  ajustes: { id: number; em: string; saldo: number }[]
}
interface Previa {
  totalLinhas: number
  erros: { linha: number; mensagem: string }[]
  compras: { chave: string; data: string; mercado: string; itens: number; total: number; totalNota: number | null }[]
  itensNovos: string[]
  mercadosNovos: string[]
}
interface Importacao {
  id: number
  arquivo: string
  criadaEm: string
  compras: number
  total: number
}

const saldo = ref<Saldo | null>(null)
const saldoTexto = ref('')
const mercados = ref<Mercado[]>([])
const novoMercado = ref('')
const novoTipo = ref<'varejo' | 'atacado'>('varejo')
const novaCategoria = ref('')
const arquivo = ref('')
const conteudo = ref('')
const previa = ref<Previa | null>(null)
const importacoes = ref<Importacao[]>([])
const versao = ref('…')
const { categorias, recarregar: recarregarCategorias } = useCategorias()
const { itens, recarregar: recarregarItens } = useItens()

const projecao = computed(() => (saldo.value?.budget.configurado ? projetarBudget(saldo.value.budget) : null))
const diaPreferidoAtual = ref(DIA_PREFERIDO_PADRAO)

async function carregarSaldo() {
  saldo.value = (await tentar(() => $fetch<Saldo>('/api/saldo'))) ?? null
}
async function carregarMercados() {
  mercados.value = (await tentar(() => $fetch<Mercado[]>('/api/mercados'))) ?? []
}
const alexa = ref<EstadoAlexa | null>(null)
const sincronizando = ref(false)

async function sincronizarAlexa() {
  sincronizando.value = true
  const r = await tentar(() => $fetch<EstadoAlexa>('/api/alexa/sincronizar', { method: 'POST' }))
  sincronizando.value = false
  if (!r) return
  alexa.value = r
  if (!r.erro) avisar(r.importados ? `${r.importados} ${r.importados === 1 ? 'item entrou' : 'itens entraram'} na lista` : 'Nada novo na Alexa')
}

function horaCurta(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function carregarImportacoes() {
  importacoes.value = (await tentar(() => $fetch<Importacao[]>('/api/importacao'))) ?? []
}

onMounted(() => {
  carregarSaldo()
  tentar(() => $fetch<Configuracao>('/api/configuracao')).then((c) => {
    if (c) diaPreferidoAtual.value = c.diaPreferido
  })
  carregarMercados()
  carregarImportacoes()
  tentar(() => $fetch<EstadoAlexa>('/api/alexa')).then((r) => {
    alexa.value = r ?? null
  })
  recarregarCategorias().catch(() => {})
  recarregarItens().catch(() => {})
  $fetch<{ version: string }>('/api/version').then((v) => (versao.value = v.version)).catch(() => {})
})

function diaCurto(dia: string) {
  const [, m, d] = dia.split('-')
  return `${d}/${m}`
}

async function ajustarSaldo() {
  const valor = parseDinheiro(saldoTexto.value)
  if (valor === null) return
  const ok = await tentar(() => $fetch('/api/saldo', { method: 'POST', body: { saldo: valor } }))
  if (!ok) return
  saldoTexto.value = ''
  avisar('Saldo ajustado')
  await carregarSaldo()
}

async function mudarDiaPreferido(valor: string) {
  const ok = await tentar(() => $fetch('/api/configuracao', { method: 'PUT', body: { diaPreferido: Number(valor) } }))
  if (!ok) return
  diaPreferidoAtual.value = Number(valor)
  avisar('Dia de ir ao mercado salvo')
  await carregarSaldo()
}

async function criarMercado() {
  const ok = await tentar(() => $fetch('/api/mercados', { method: 'POST', body: { nome: novoMercado.value, tipo: novoTipo.value } }))
  if (!ok) return
  novoMercado.value = ''
  await carregarMercados()
}
async function renomearMercado(m: Mercado, nome: string) {
  if (!nome.trim() || nome === m.nome) return
  await tentar(() => $fetch(`/api/mercados/${m.id}`, { method: 'PATCH', body: { nome } }))
  await carregarMercados()
}
async function mudarTipo(m: Mercado, tipo: string) {
  await tentar(() => $fetch(`/api/mercados/${m.id}`, { method: 'PATCH', body: { tipo } }))
  await carregarMercados()
}
async function apagarMercado(m: Mercado) {
  if (!confirm(`Apagar ${m.nome}?`)) return
  await tentar(() => $fetch(`/api/mercados/${m.id}`, { method: 'DELETE' }))
  await carregarMercados()
}

async function criarCategoria() {
  const ok = await tentar(() => $fetch('/api/categorias', { method: 'POST', body: { nome: novaCategoria.value } }))
  if (!ok) return
  novaCategoria.value = ''
  await recarregarCategorias()
}
async function renomearCategoria(c: Categoria, nome: string) {
  if (!nome.trim() || nome === c.nome) return
  await tentar(() => $fetch(`/api/categorias/${c.id}`, { method: 'PATCH', body: { nome } }))
  await recarregarCategorias()
}
async function apagarCategoria(c: Categoria) {
  if (!confirm(`Apagar a categoria ${c.nome}?`)) return
  await tentar(() => $fetch(`/api/categorias/${c.id}`, { method: 'DELETE' }))
  await recarregarCategorias()
}
async function mover(i: number, passo: number) {
  const ids = categorias.value.map((c) => c.id)
  const [id] = ids.splice(i, 1)
  ids.splice(i + passo, 0, id!)
  await tentar(() => $fetch('/api/categorias/ordem', { method: 'PUT', body: ids }))
  await recarregarCategorias()
}

async function lerArquivo(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  const f = entrada.files?.[0]
  if (!f) return
  arquivo.value = f.name
  conteudo.value = await f.text()
  entrada.value = ''
  previa.value =
    (await tentar(() =>
      $fetch<Previa>('/api/importacao', { method: 'POST', body: { arquivo: f.name, conteudo: conteudo.value } }),
    )) ?? null
}

async function confirmarImportacao() {
  const r = await tentar(() =>
    $fetch<{ compras: number; itens: number }>('/api/importacao', {
      method: 'POST',
      body: { arquivo: arquivo.value, conteudo: conteudo.value, confirmar: true },
    }),
  )
  if (!r) return
  previa.value = null
  avisar(`${r.compras} compras importadas (${r.itens} itens)`)
  await Promise.all([carregarImportacoes(), recarregarItens(), carregarMercados(), recarregarCategorias()])
}

async function desfazer(imp: Importacao) {
  if (!confirm(`Desfazer a importação de ${imp.arquivo}? As ${imp.compras} compras dela serão apagadas.`)) return
  await tentar(() => $fetch(`/api/importacao/${imp.id}`, { method: 'DELETE' }))
  await carregarImportacoes()
}
</script>

<style scoped>
section {
  scroll-margin-top: 1rem;
}

.cresce {
  flex: 1;
  min-width: 0;
}

.ajuste {
  margin-top: 0.75rem;
}

.dica {
  margin: 0.4rem 0 0;
}

.simples {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: grid;
  gap: 0.3rem;
}

.lista input,
.lista select {
  min-height: 2.25rem;
  padding: 0.35rem 0.5rem;
}

.tipo {
  width: auto;
}

.setas {
  display: flex;
}

.setas .icone {
  min-width: 2rem;
  font-size: 1rem;
}

.novo {
  margin-top: 0.5rem;
}

.resultado {
  margin-top: 0.5rem;
}

.link {
  color: inherit;
  text-decoration: none;
}

.previa {
  margin-top: 0.75rem;
}

.previa p {
  margin: 0 0 0.5rem;
}

.acoes {
  justify-content: flex-end;
  margin-top: 0.75rem;
}

.versao {
  text-align: center;
  margin-top: 2rem;
}
</style>
