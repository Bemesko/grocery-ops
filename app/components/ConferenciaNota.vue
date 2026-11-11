<!--
  Nota fiscal de uma compra: leitura pelo QR e conferência das linhas da nota com os itens
  anotados (docs/produto-v1.md, "Nota fiscal (NFC-e)"). Emite `mudou` quando a compra muda
  (total da nota, itens), para a página recarregar o resumo.
-->
<template>
  <section class="nota">
    <h2>Nota fiscal</h2>

    <template v-if="!c || c.estado === 'sem_nota'">
      <p class="suave">Leia o QR da nota para conferir os itens e completar os dados da compra.</p>
      <button type="button" class="botao" :disabled="lendo" @click="leitor = true">Ler nota fiscal</button>
    </template>

    <template v-else-if="c.estado === 'pendente'">
      <p class="aviso alerta">
        {{
          mensagem ??
          'A última leitura não trouxe os itens: a SEFAZ pediu uma verificação de segurança ou limitou as consultas. Abra a nota no navegador ou tente de novo mais tarde.'
        }}
      </p>
      <div class="linha botoes">
        <a v-if="c.url" class="botao" :href="c.url" target="_blank" rel="noopener noreferrer">Abrir a nota</a>
        <button type="button" class="botao" :disabled="lendo" @click="ler(c.url!)">Tentar de novo</button>
        <button type="button" class="botao" :disabled="lendo" @click="leitor = true">Ler outro QR</button>
      </div>
    </template>

    <template v-else>
      <div class="cartao cabeca">
        <div class="linha">
          <strong class="cresce">{{ emitente }}</strong>
          <span v-if="c.estado === 'conferida'" class="selo igual">conferida ✓</span>
        </div>
        <div class="suave">
          {{ emitidaEm }} · {{ c.linhas.length }} {{ c.linhas.length === 1 ? 'linha' : 'linhas' }}
          <template v-if="c.desconto"> · desconto {{ formatarDinheiro(c.desconto) }}</template>
        </div>
        <div class="linha">
          <span class="cresce">A pagar</span>
          <strong class="num">{{ formatarDinheiro(c.aPagar) }}</strong>
        </div>
      </div>

      <template v-if="c.estado === 'conferida' && !editando">
        <ul class="lista">
          <li v-for="l in c.linhas" :key="l.ordem">
            <span class="cresce">
              {{ nomeAnotado(l.compraItemId) ?? 'fora da compra' }}
              <span class="suave descricao">{{ l.descricao }}</span>
            </span>
            <span class="num">{{ formatarDinheiro(l.total) }}</span>
          </li>
        </ul>
        <div class="linha botoes">
          <button type="button" class="botao" @click="editar">Refazer conferência</button>
          <button type="button" class="botao" :disabled="lendo" @click="leitor = true">Ler outra nota</button>
        </div>
      </template>

      <form v-else class="conferencia" @submit.prevent="confirmar">
        <p class="suave">Confira cada linha da nota. O preço e a quantidade da nota substituem os anotados.</p>
        <datalist id="itens-da-nota">
          <option v-for="i in itens" :key="i.id" :value="i.nome" />
        </datalist>
        <ul class="lista">
          <li v-for="l in c.linhas" :key="l.ordem" class="linha-nota">
            <div class="linha">
              <span class="cresce descricao-nota">{{ l.descricao }}</span>
              <span class="num">{{ formatarDinheiro(l.total) }}</span>
            </div>
            <div class="suave">
              {{ quantidadeNota(l) }} × {{ formatarDinheiro(l.unitario) }}
              <template v-if="l.embalagem"> · {{ formatarEmbalagem(l.embalagem) }}</template>
              <span v-if="l.nivel === 'sugerido' && escolhas[l.ordem]?.tipo === `ci:${l.compraItemId}`" class="selo neutro estado">confira</span>
              <span v-else-if="l.nivel === 'certo' || l.nivel === 'confirmado'" class="ok estado">✓</span>
              <span v-else-if="!l.compraItemId" class="atencao estado">não anotado</span>
            </div>
            <select v-model="escolhas[l.ordem]!.tipo" :aria-label="`Item da linha ${l.ordem}`">
              <option v-for="a in anotados" :key="a.id" :value="`ci:${a.id}`">
                {{ a.nome }} ({{ formatarQuantidade(a.quantidade, a.unidade) }} × {{ formatarDinheiro(a.precoUnitario) }})
              </option>
              <option value="novo">Entra na compra como…</option>
              <option value="ignorar">Deixar de fora</option>
            </select>
            <div v-if="escolhas[l.ordem]!.tipo === 'novo'" class="novo">
              <input v-model="escolhas[l.ordem]!.nome" list="itens-da-nota" placeholder="Nome do item" maxlength="80" />
              <select v-if="!itemExistente(escolhas[l.ordem]!.nome)" v-model="escolhas[l.ordem]!.categoriaId" aria-label="Categoria">
                <option :value="null" disabled>Categoria do item novo</option>
                <option v-for="cat in categorias" :key="cat.id" :value="cat.id">{{ cat.nome }}</option>
              </select>
            </div>
          </li>
        </ul>

        <template v-if="semPar.length">
          <h3>Anotados que não estão na nota</h3>
          <ul class="lista">
            <li v-for="a in semPar" :key="a.id">
              <label class="cresce marcar">
                <input v-model="remover" type="checkbox" :value="a.id" />
                {{ a.nome }}
                <span class="suave">· tirar da compra</span>
              </label>
              <span class="num">{{ formatarDinheiro(a.total) }}</span>
            </li>
          </ul>
        </template>

        <p v-if="problema" class="aviso perigo">{{ problema }}</p>
        <div class="linha botoes fim">
          <button v-if="c.estado === 'conferida'" type="button" class="botao" @click="editando = false">Voltar</button>
          <button type="submit" class="botao primario" :disabled="salvando">Confirmar conferência</button>
        </div>
      </form>
    </template>

    <LeitorQr v-if="leitor" @lido="aoLer" @fechar="leitor = false" />
  </section>
</template>

<script setup lang="ts">
import type { CompraItem, ConferenciaNota, DecisaoLinha, LinhaConferencia, RespostaLeituraNota } from '../../shared/types/api'

const props = defineProps<{ compraId: number; anotados: CompraItem[] }>()
const emit = defineEmits<{ mudou: [] }>()

const c = ref<ConferenciaNota | null>(null)
const mensagem = ref<string | null>(null)
const leitor = ref(false)
const lendo = ref(false)
const salvando = ref(false)
const editando = ref(false)
const problema = ref<string | null>(null)
const remover = ref<number[]>([])

interface Escolha {
  tipo: string
  nome: string
  categoriaId: number | null
}
const escolhas = reactive<Record<number, Escolha>>({})

const { itens, recarregar: recarregarItens } = useItens()
const { categorias, recarregar: recarregarCategorias } = useCategorias()

const emitente = computed(() => (c.value?.emitente ? limparNome(c.value.emitente.toLowerCase()) : 'Nota fiscal'))
const emitidaEm = computed(() =>
  c.value?.emitidaEm
    ? new Date(c.value.emitidaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '',
)

const usados = computed(() => new Set(Object.values(escolhas).map((e) => e.tipo)))
const semPar = computed(() => props.anotados.filter((a) => !usados.value.has(`ci:${a.id}`)))

function nomeAnotado(id: number | null) {
  return id ? (props.anotados.find((a) => a.id === id)?.nome ?? null) : null
}

function quantidadeNota(l: LinhaConferencia) {
  return formatarQuantidade(l.quantidade, unidadeDaNota(l.unidade))
}

function itemExistente(nome: string) {
  const chave = normalizarNome(nome)
  return Boolean(chave) && itens.value.some((i) => normalizarNome(i.nome) === chave)
}

function prepararEscolhas() {
  for (const k of Object.keys(escolhas)) delete escolhas[Number(k)]
  for (const l of c.value?.linhas ?? []) {
    const anotadoExiste = l.compraItemId && props.anotados.some((a) => a.id === l.compraItemId)
    escolhas[l.ordem] = {
      tipo: anotadoExiste ? `ci:${l.compraItemId}` : 'novo',
      nome: l.nomeSugerido,
      categoriaId: null,
    }
  }
  remover.value = []
  problema.value = null
}

function aplicar(conferencia: ConferenciaNota) {
  c.value = conferencia
  editando.value = conferencia.estado === 'lida'
  prepararEscolhas()
}

async function carregar() {
  const resposta = await tentar(() => $fetch<ConferenciaNota>(`/api/compras/${props.compraId}/nfce`))
  if (resposta) aplicar(resposta)
}

onMounted(() => {
  carregar()
  if (!itens.value.length) recarregarItens().catch(() => {})
  if (!categorias.value.length) recarregarCategorias().catch(() => {})
})

function aoLer(texto: string) {
  leitor.value = false
  ler(texto)
}

async function ler(url: string) {
  lendo.value = true
  const resposta = await tentar(() =>
    $fetch<RespostaLeituraNota>(`/api/compras/${props.compraId}/nfce`, { method: 'POST', body: { url } }),
  )
  lendo.value = false
  if (!resposta) return
  mensagem.value = resposta.mensagem
  aplicar(resposta.conferencia)
  if (resposta.resultado === 'ok') {
    const n = resposta.conferencia.linhas.length
    avisar(`Nota lida: ${n} ${n === 1 ? 'linha' : 'linhas'}`)
    emit('mudou')
  } else {
    avisar(resposta.mensagem ?? 'Não consegui ler a nota', 'erro')
  }
}

function editar() {
  prepararEscolhas()
  editando.value = true
}

async function confirmar() {
  if (!c.value) return
  const decisoes: DecisaoLinha[] = []
  const vistos = new Set<string>()
  for (const l of c.value.linhas) {
    const e = escolhas[l.ordem]!
    if (e.tipo === 'ignorar') decisoes.push({ ordem: l.ordem, ignorar: true })
    else if (e.tipo === 'novo') {
      const nome = e.nome.trim()
      if (!nome) return (problema.value = `Dê um nome ao item da linha ${l.ordem}.`)
      if (!itemExistente(nome) && !e.categoriaId) return (problema.value = `Escolha a categoria de “${limparNome(nome)}”.`)
      decisoes.push({ ordem: l.ordem, nome, categoriaId: e.categoriaId ?? undefined })
    } else {
      if (vistos.has(e.tipo)) return (problema.value = `${nomeAnotado(Number(e.tipo.slice(3)))} está em duas linhas da nota.`)
      vistos.add(e.tipo)
      decisoes.push({ ordem: l.ordem, compraItemId: Number(e.tipo.slice(3)) })
    }
  }
  problema.value = null
  salvando.value = true
  const resposta = await tentar(() =>
    $fetch<ConferenciaNota>(`/api/compras/${props.compraId}/nfce/confirmar`, {
      method: 'POST',
      body: { decisoes, remover: remover.value },
    }),
  )
  salvando.value = false
  if (!resposta) return
  avisar('Conferência salva')
  emit('mudou')
  recarregarItens().catch(() => {})
  aplicar(resposta)
}

// Os itens anotados chegam depois (o resumo recarrega): refaz as escolhas padrão.
watch(
  () => props.anotados.map((a) => a.id).join(','),
  () => {
    if (editando.value) prepararEscolhas()
  },
)
</script>

<style scoped>
.cabeca {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.botoes {
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.botoes.fim {
  justify-content: flex-end;
}

.linha-nota {
  display: grid !important;
  gap: 0.35rem;
}

.descricao-nota,
.descricao {
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.descricao {
  display: block;
}

.linha-nota select,
.novo input,
.novo select {
  width: 100%;
  min-width: 0;
}

.estado {
  margin-left: 0.4rem;
}

.novo {
  display: grid;
  gap: 0.35rem;
}

.marcar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

h3 {
  font-size: 1rem;
  margin: 1rem 0 0.25rem;
}
</style>
