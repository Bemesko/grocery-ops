<template>
  <NuxtPwaManifest />
  <NuxtPwaAssets />
  <NuxtPage :page-key="(r) => r.fullPath" />
  <NavInferior />
  <Transition name="aviso">
    <div v-if="aviso" class="toast" :class="aviso.tipo" role="status" @click="aviso = null">
      {{ aviso.texto }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
const aviso = useAviso()
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
