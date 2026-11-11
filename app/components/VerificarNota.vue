<!--
  A SEFAZ-SC sempre pede uma verificação de segurança para o link do QR, e só um navegador
  de verdade passa por ela. Este painel guia: abrir a nota no navegador, passar a
  verificação e trazer de volta o link da página da nota (Compartilhar → Grocery Ops no
  Android; copiar e "Colar link da nota" no iPhone). Sempre a página detalhada: só ela traz
  o desconto de cada item. Emite `link` com o link verificado.
  Sem <form>: ele também aparece dentro da folha de finalizar compra, que já é um form.
-->
<template>
  <div class="verificar">
    <p v-if="mensagem" class="aviso alerta">{{ mensagem }}</p>
    <p><strong>Para trazer os itens com o desconto de cada um:</strong></p>
    <ol>
      <li>Toque em <strong>Abrir a nota</strong> e passe a verificação no navegador.</li>
      <li>
        No fim da página da nota, toque em <strong>Ver NFC-e detalhada</strong> (passe a verificação de novo, se
        pedir).
      </li>
      <li>
        Na página detalhada, <strong>compartilhe com o Grocery Ops</strong> (Android) ou <strong>copie o link</strong> e
        volte aqui para colar. Faça isso logo: esse link vale só alguns minutos.
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
defineProps<{ url: string; ocupado?: boolean; mensagem?: string | null }>()
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
      'Esse ainda é o link do QR. Abra a nota, passe a verificação, toque em "Ver NFC-e detalhada" e copie o link dessa página.'
    campo.value = true
    return
  }
  if (ehPaginaSimples(url)) {
    aviso.value = 'Essa é a página simples da nota. Toque em "Ver NFC-e detalhada" nela e copie o link da página detalhada.'
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
