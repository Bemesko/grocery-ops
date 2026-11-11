<!--
  A SEFAZ-SC sempre pede uma verificação de segurança para o link do QR, e só um navegador
  de verdade passa por ela. Este painel guia: abrir a nota no navegador, passar a
  verificação e trazer de volta o link da página da nota (Compartilhar → Grocery Ops no
  Android; copiar e "Colar link da nota" no iPhone). Emite `link` com o link verificado.
  Sem <form>: ele também aparece dentro da folha de finalizar compra, que já é um form.
-->
<template>
  <div class="verificar">
    <p><strong>A SEFAZ pede uma verificação para mostrar os itens da nota.</strong></p>
    <ol>
      <li>Toque em <strong>Abrir a nota</strong> e passe a verificação no navegador.</li>
      <li>
        Quando os itens aparecerem, <strong>compartilhe a página com o Grocery Ops</strong> (Android) ou
        <strong>copie o link</strong> e volte aqui para colar.
      </li>
    </ol>
    <div class="linha botoes">
      <a class="botao primario" :href="url" target="_blank" rel="noopener noreferrer">Abrir a nota</a>
      <button type="button" class="botao" :disabled="ocupado" @click="colar">Colar link da nota</button>
    </div>
    <div v-if="campo" class="linha colar">
      <input
        v-model="texto"
        class="cresce"
        type="url"
        inputmode="url"
        placeholder="Cole aqui o link da página da nota"
        @keydown.enter.prevent="enviar(texto)"
      />
      <button type="button" :disabled="ocupado || !texto.trim()" @click="enviar(texto)">Enviar</button>
    </div>
    <p v-if="aviso" class="aviso alerta">{{ aviso }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ url: string; ocupado?: boolean }>()
const emit = defineEmits<{ link: [url: string] }>()

const campo = ref(false)
const texto = ref('')
const aviso = ref<string | null>(null)

function enviar(conteudo: string) {
  const url = urlNfceDoTexto(conteudo)
  if (!url) {
    aviso.value = 'Não achei um link da nota da SEFAZ-SC aí. Copie o link da página da nota e tente de novo.'
    campo.value = true
    return
  }
  if (ehLinkDoQr(url)) {
    aviso.value =
      'Esse ainda é o link do QR. Abra a nota, passe a verificação e copie o link da página que mostra os itens.'
    campo.value = true
    return
  }
  aviso.value = null
  emit('link', url)
}

async function colar() {
  try {
    const conteudo = await navigator.clipboard.readText()
    enviar(conteudo)
  } catch {
    // Sem permissão (ou navegador sem a API): cola à mão.
    campo.value = true
    aviso.value = null
  }
}
</script>

<style scoped>
.verificar {
  display: grid;
  gap: 0.5rem;
}

.verificar p,
.verificar ol {
  margin: 0;
}

.verificar ol {
  padding-left: 1.25rem;
  display: grid;
  gap: 0.35rem;
}

.botoes {
  flex-wrap: wrap;
  gap: 0.5rem;
}

.colar input {
  min-width: 0;
}
</style>
