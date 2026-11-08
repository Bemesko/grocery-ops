/**
 * Arrastar linhas para o lado (Lista): esquerda e direita disparam ações diferentes.
 * Só vira arraste quando o gesto é claramente horizontal; o scroll vertical segue normal
 * (a linha usa `touch-action: pan-y`). Depois de um arraste, o clique que o navegador
 * dispara ao soltar é engolido, para não abrir a edição da linha.
 */
export type Direcao = 'esquerda' | 'direita'

const LIMIAR = 0.35 // fração da largura da linha
const INICIO = 10 // px antes de decidir se o gesto é horizontal

export function useArrastar(aoSoltar: (id: number, direcao: Direcao) => unknown) {
  const ativo = ref<number | null>(null)
  const dx = ref(0)
  const soltando = ref(false)
  let inicioX = 0
  let inicioY = 0
  let largura = 1
  let modo: 'indeciso' | 'horizontal' | 'vertical' = 'indeciso'
  let engolir = false

  function baixar(id: number, e: PointerEvent) {
    if (e.button !== 0 || soltando.value) return
    ativo.value = id
    dx.value = 0
    inicioX = e.clientX
    inicioY = e.clientY
    largura = (e.currentTarget as HTMLElement).offsetWidth || 1
    modo = 'indeciso'
  }

  function mover(id: number, e: PointerEvent) {
    if (ativo.value !== id || modo === 'vertical') return
    const x = e.clientX - inicioX
    const y = e.clientY - inicioY
    if (modo === 'indeciso') {
      if (Math.abs(x) > INICIO && Math.abs(x) > Math.abs(y) * 1.5) {
        modo = 'horizontal'
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } else if (Math.abs(y) > INICIO) {
        modo = 'vertical'
        return
      } else return
    }
    e.preventDefault()
    dx.value = x
  }

  function soltar(id: number) {
    if (ativo.value !== id) return
    const foiHorizontal = modo === 'horizontal'
    modo = 'indeciso'
    if (!foiHorizontal) {
      ativo.value = null
      return
    }
    engolir = true
    setTimeout(() => (engolir = false), 50)
    if (Math.abs(dx.value) < largura * LIMIAR) {
      dx.value = 0
      ativo.value = null
      return
    }
    const direcao: Direcao = dx.value > 0 ? 'direita' : 'esquerda'
    soltando.value = true
    dx.value = direcao === 'direita' ? largura : -largura
    setTimeout(async () => {
      await aoSoltar(id, direcao)
      soltando.value = false
      ativo.value = null
      dx.value = 0
    }, 180)
  }

  function cancelar(id: number) {
    if (ativo.value !== id || soltando.value) return
    modo = 'indeciso'
    dx.value = 0
    ativo.value = null
  }

  /** Eventos e estilo de uma linha. `desligado`: a linha não arrasta (ex.: em edição). */
  function linha(id: number, desligado = false) {
    const deslocamento = ativo.value === id ? dx.value : 0
    return {
      deslocamento,
      direcao: deslocamento > 0 ? 'direita' : deslocamento < 0 ? 'esquerda' : null,
      passou: Math.abs(deslocamento) >= largura * LIMIAR,
      eventos: desligado
        ? {}
        : {
            pointerdown: (e: PointerEvent) => baixar(id, e),
            pointermove: (e: PointerEvent) => mover(id, e),
            pointerup: () => soltar(id),
            pointercancel: () => cancelar(id),
            // fase de captura: chega antes do clique da linha (que abre a edição)
            clickCapture: (e: MouseEvent) => {
              if (engolir) {
                e.stopPropagation()
                e.preventDefault()
              }
            },
          },
      estilo: {
        transform: deslocamento ? `translateX(${deslocamento}px)` : undefined,
        transition: modo === 'horizontal' && !soltando.value ? 'none' : 'transform 0.18s ease',
      },
    }
  }

  return { linha }
}
