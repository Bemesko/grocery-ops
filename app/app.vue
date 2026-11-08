<template>
  <NuxtPwaManifest />
  <NuxtPwaAssets />
  <FaixaSemBanco />
  <NuxtPage :page-key="(r) => r.fullPath" />
  <NavInferior />
  <Transition name="aviso">
    <div v-if="aviso" class="toast" :class="aviso.tipo" role="status" @click="aviso = null">
      <span>{{ aviso.texto }}</span>
      <button v-if="aviso.acao" type="button" class="acao-toast" @click.stop="executarAcao">
        {{ aviso.acao.rotulo }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const aviso = useAviso()

function executarAcao() {
  const acao = aviso.value?.acao
  aviso.value = null
  acao?.executar()
}
</script>

<style>
.toast {
  position: fixed;
  left: 50%;
  bottom: 5rem;
  transform: translateX(-50%);
  max-width: calc(100% - 2rem);
  background: var(--texto);
  color: var(--fundo);
  padding: 0.65rem 1rem;
  border-radius: 0.6rem;
  box-shadow: var(--sombra);
  z-index: 50;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.acao-toast {
  background: none;
  border: 0;
  /* o toast tem as cores invertidas: verde claro no tema claro, escuro no escuro */
  color: #9ae6b4;
  font-weight: 700;
  padding: 0.25rem 0.25rem;
  min-height: auto;
  white-space: nowrap;
}

@media (prefers-color-scheme: dark) {
  .acao-toast {
    color: #276749;
  }
}

.toast.erro {
  background: var(--perigo);
  color: #fff;
}

.aviso-enter-active,
.aviso-leave-active {
  transition: opacity 0.2s;
}

.aviso-enter-from,
.aviso-leave-to {
  opacity: 0;
}
</style>
