/**
 * Modo "ocultar valores": troca os valores em R$ por "R$ •••••" no app inteiro (percentuais,
 * quantidades e barras continuam). A escolha fica neste aparelho (localStorage).
 */
const CHAVE = 'ocultar-valores'

export function useOcultarValores() {
  const ocultos = useState<boolean>('ocultar-valores', () => {
    if (import.meta.server) return false
    try {
      return localStorage.getItem(CHAVE) === '1'
    } catch {
      return false
    }
  })
  function alternar() {
    ocultos.value = !ocultos.value
    try {
      localStorage.setItem(CHAVE, ocultos.value ? '1' : '0')
    } catch {
      // sem armazenamento local: vale até fechar o app
    }
  }
  return { ocultos, alternar }
}
