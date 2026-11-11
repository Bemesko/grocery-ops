<!--
  Leitura do QR da NFC-e pela câmera. Usa o BarcodeDetector do navegador quando existe
  (Chrome no Android) e, senão, o jsQR carregado só quando a câmera abre (iPhone). A câmera
  exige HTTPS (o ingress do Tailscale) ou localhost. Também aceita colar o link.
  Emite `lido` com o texto do QR (ou o link colado).
-->
<template>
  <div class="fundo" @click.self="$emit('fechar')">
    <div class="folha-qr">
      <h2>{{ titulo }}</h2>
      <div v-if="estado !== 'sem_camera'" class="visor">
        <video ref="video" playsinline muted />
        <span class="mira" aria-hidden="true" />
        <p v-if="estado === 'abrindo'" class="suave legenda">Abrindo a câmera…</p>
      </div>
      <p v-else class="aviso alerta">{{ motivo }}</p>
      <form class="linha colar" @submit.prevent="enviarColado">
        <input v-model="colado" class="cresce" type="url" inputmode="url" placeholder="ou cole o link da nota" />
        <button type="submit" :disabled="!colado.trim()">Ler</button>
      </form>
      <div class="linha acoes">
        <button type="button" @click="$emit('fechar')">Fechar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ titulo?: string }>(), { titulo: 'Ler a nota fiscal' })
const emit = defineEmits<{ lido: [texto: string]; fechar: [] }>()

const video = ref<HTMLVideoElement>()
const estado = ref<'abrindo' | 'lendo' | 'sem_camera'>('abrindo')
const motivo = ref('')
const colado = ref('')

let fluxo: MediaStream | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let encerrado = false

type Detectar = (fonte: HTMLVideoElement) => Promise<string | null>

interface DetectorNativo {
  detect(fonte: CanvasImageSource): Promise<{ rawValue: string }[]>
}

async function criarDetector(): Promise<Detectar> {
  const Nativo = (globalThis as { BarcodeDetector?: { new (o: object): DetectorNativo; getSupportedFormats(): Promise<string[]> } })
    .BarcodeDetector
  if (Nativo && (await Nativo.getSupportedFormats().catch(() => [])).includes('qr_code')) {
    const detector = new Nativo({ formats: ['qr_code'] })
    return async (fonte) => (await detector.detect(fonte))[0]?.rawValue ?? null
  }
  const { default: jsQR } = await import('jsqr')
  const tela = document.createElement('canvas')
  const ctx = tela.getContext('2d', { willReadFrequently: true })!
  return async (fonte) => {
    const escala = Math.min(1, 800 / Math.max(fonte.videoWidth, fonte.videoHeight))
    tela.width = Math.round(fonte.videoWidth * escala)
    tela.height = Math.round(fonte.videoHeight * escala)
    if (!tela.width || !tela.height) return null
    ctx.drawImage(fonte, 0, 0, tela.width, tela.height)
    const imagem = ctx.getImageData(0, 0, tela.width, tela.height)
    return jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

function semCamera(texto: string) {
  estado.value = 'sem_camera'
  motivo.value = texto
}

onMounted(async () => {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    semCamera('A câmera só abre pelo endereço com HTTPS do app. Cole o link da nota.')
    return
  }
  try {
    fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
  } catch {
    semCamera('Não consegui abrir a câmera (permissão negada?). Cole o link da nota.')
    return
  }
  if (encerrado) return parar()
  const v = video.value!
  v.srcObject = fluxo
  await v.play().catch(() => {})
  const detectar = await criarDetector()
  estado.value = 'lendo'
  const ler = async () => {
    if (encerrado) return
    const texto = v.readyState >= 2 ? await detectar(v).catch(() => null) : null
    if (texto) {
      navigator.vibrate?.(60)
      parar()
      emit('lido', texto)
      return
    }
    timer = setTimeout(ler, 250)
  }
  ler()
})

function parar() {
  encerrado = true
  clearTimeout(timer)
  fluxo?.getTracks().forEach((t) => t.stop())
  fluxo = null
}

function enviarColado() {
  const texto = colado.value.trim()
  if (!texto) return
  parar()
  emit('lido', texto)
}

onBeforeUnmount(parar)
</script>

<style scoped>
.fundo {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 50%);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 50;
}

.folha-qr {
  background: var(--superficie);
  width: 100%;
  max-width: 40rem;
  border-radius: 1rem 1rem 0 0;
  padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
}

.folha-qr h2 {
  margin-top: 0;
}

.visor {
  position: relative;
  aspect-ratio: 1;
  max-height: 55vh;
  margin: 0 auto 0.75rem;
  border-radius: 0.75rem;
  overflow: hidden;
  background: #000;
}

.visor video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mira {
  position: absolute;
  inset: 18%;
  border: 3px solid rgb(255 255 255 / 85%);
  border-radius: 0.75rem;
  box-shadow: 0 0 0 100vmax rgb(0 0 0 / 25%);
}

.legenda {
  position: absolute;
  inset: auto 0 0.5rem;
  text-align: center;
  color: #fff;
}

.colar input {
  min-width: 0;
}

.acoes {
  justify-content: flex-end;
  margin-top: 0.75rem;
}
</style>
