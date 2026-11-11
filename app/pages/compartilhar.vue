<!--
  Destino do Compartilhar do Android (share_target do manifest, só com o app instalado):
  a pessoa passa a verificação da SEFAZ no navegador e compartilha a página da nota com o
  Grocery Ops. Se uma compra já espera esta nota (o QR foi lido nela), a nota entra direto;
  senão a pessoa escolhe a compra ou cria uma só pela nota.
-->
<template>
  <main class="pagina">
    <header class="cabecalho">
      <h1>Nota compartilhada</h1>
      <OlhoValores />
    </header>

    <p v-if="estado === 'lendo'" class="suave">Lendo a nota…</p>

    <template v-else-if="estado === 'qr'">
      <div class="cartao">
        <p>
          Esse é o link do QR, que a SEFAZ ainda não liberou. Abra a nota, passe a verificação e compartilhe a
          <strong>página que mostra os itens</strong>.
        </p>
        <a v-if="url" class="botao primario" :href="url" target="_blank" rel="noopener noreferrer">Abrir a nota</a>
      </div>
    </template>

    <template v-else-if="estado === 'escolher' && escolha">
      <div class="cartao">
        <strong>{{ escolha.nota.emitente }}</strong>
        <div class="suave">
          {{ dataHora(escolha.nota.emitidaEm) }} · {{ escolha.nota.itens }} {{ escolha.nota.itens === 1 ? 'linha' : 'linhas' }}
        </div>
        <div class="linha">
          <span class="cresce">A pagar</span>
          <strong class="num">{{ formatarDinheiro(escolha.nota.aPagar) }}</strong>
        </div>
      </div>
      <h2>Em qual compra ela entra?</h2>
      <ul class="lista">
        <li v-for="c in escolha.candidatos" :key="c.id">
          <button type="button" class="destino" :disabled="ocupado" @click="paraCompra(c.id)">
            <span class="cresce">
              <strong>{{ c.mercado }}</strong>
              <span class="suave"> · {{ c.status === 'em_andamento' ? 'em andamento' : dataCurta(c.data) }}</span>
              <span v-if="c.mesmoMercado" class="selo neutro">mesmo mercado</span>
            </span>
            <span class="num">{{ formatarDinheiro(c.total) }}</span>
          </button>
        </li>
        <li>
          <button type="button" class="destino" :disabled="ocupado" @click="compraNova">
            <span class="cresce"><strong>Compra nova só pela nota</strong></span>
          </button>
        </li>
      </ul>
    </template>

    <template v-else-if="estado === 'falhou'">
      <p class="aviso alerta">{{ mensagem }}</p>
      <a v-if="url" class="botao" :href="url" target="_blank" rel="noopener noreferrer">Abrir a nota</a>
    </template>
  </main>
</template>

<script setup lang="ts">
interface Candidato {
  id: number
  mercado: string
  data: string
  status: 'em_andamento' | 'finalizada'
  total: number
  mesmoMercado: boolean
}

type Resposta =
  | { resultado: 'qr'; url: string; compraId: number | null }
  | { resultado: 'ok'; compraId: number }
  | {
      resultado: 'escolher'
      nota: { emitente: string; emitidaEm: string | null; aPagar: number; itens: number }
      candidatos: Candidato[]
    }
  | { resultado: 'verificacao' | 'simples' | 'limite' | 'erro'; mensagem: string }

const rota = useRoute()
const estado = ref<'lendo' | 'qr' | 'escolher' | 'falhou'>('lendo')
const url = ref<string | null>(null)
const mensagem = ref<string | null>(null)
const escolha = ref<Extract<Resposta, { resultado: 'escolher' }> | null>(null)
const ocupado = ref(false)

onMounted(async () => {
  const q = rota.query
  const texto = [q.url, q.text, q.title].filter((v) => typeof v === 'string').join(' ')
  // O link abre a nota inteira: sai da barra de endereço e do histórico.
  history.replaceState(history.state, '', '/compartilhar')
  url.value = urlNfceDoTexto(texto)
  if (!url.value) {
    estado.value = 'falhou'
    mensagem.value = 'O que foi compartilhado não tem um link de nota fiscal da SEFAZ-SC.'
    return
  }
  const r = await tentar(() => $fetch<Resposta>('/api/nfce/compartilhada', { method: 'POST', body: { url: url.value } }))
  if (!r) {
    estado.value = 'falhou'
    mensagem.value = 'Não consegui ler a nota.'
    return
  }
  if (r.resultado === 'ok') return navigateTo(`/compras/${r.compraId}`, { replace: true })
  if (r.resultado === 'qr') {
    estado.value = 'qr'
    return
  }
  if (r.resultado === 'escolher') {
    escolha.value = r
    estado.value = 'escolher'
    return
  }
  estado.value = 'falhou'
  mensagem.value = r.mensagem
})

async function paraCompra(id: number) {
  ocupado.value = true
  const r = await tentar(() => $fetch(`/api/compras/${id}/nfce`, { method: 'POST', body: { url: url.value } }))
  ocupado.value = false
  if (r) await navigateTo(`/compras/${id}`, { replace: true })
}

async function compraNova() {
  useNotaCompartilhada().value = url.value
  await navigateTo('/compras', { replace: true })
}

function dataCurta(dia: string) {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function dataHora(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''
}
</script>

<style scoped>
.cartao {
  display: grid;
  gap: 0.5rem;
}

.cartao p {
  margin: 0;
}

.destino {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.cresce {
  flex: 1;
  min-width: 0;
}
</style>
