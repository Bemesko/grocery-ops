// Chave de acesso da NFC-e (44 dígitos, impressa na nota e presente no QR do formato
// nacional `...?p=<chave>|...`). Ela sozinha já identifica a nota e o emitente, sem
// consultar a SEFAZ (docs/produto-v1.md, "Nota fiscal (NFC-e)").

export interface ChaveNfce {
  chave: string
  /** Código IBGE da UF (42 = SC). */
  uf: string
  /** Ano e mês de emissão, AAAA-MM. */
  mes: string
  cnpj: string
  /** 65 = NFC-e. */
  modelo: string
  serie: number
  numero: number
}

/** Dígito verificador (módulo 11, pesos 2 a 9 da direita para a esquerda). */
export function digitoChave(primeiros43: string): number {
  let soma = 0
  let peso = 2
  for (let i = primeiros43.length - 1; i >= 0; i--) {
    soma += Number(primeiros43[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/**
 * Acha uma chave válida num texto: o conteúdo do QR (`?p=<chave>|2|1|...`) ou a chave
 * digitada com espaços. null se não houver 44 dígitos seguidos com o dígito certo.
 */
export function lerChave(texto: string | null | undefined): ChaveNfce | null {
  if (!texto) return null
  const candidatos = [...texto.matchAll(/\d[\d\s]{42,}\d/g)].map((m) => m[0].replace(/\s/g, ''))
  for (const c of candidatos) {
    for (let i = 0; i + 44 <= c.length; i++) {
      const chave = c.slice(i, i + 44)
      if (digitoChave(chave.slice(0, 43)) !== Number(chave[43])) continue
      return {
        chave,
        uf: chave.slice(0, 2),
        mes: `20${chave.slice(2, 4)}-${chave.slice(4, 6)}`,
        cnpj: chave.slice(6, 20),
        modelo: chave.slice(20, 22),
        serie: Number(chave.slice(22, 25)),
        numero: Number(chave.slice(25, 34)),
      }
    }
  }
  return null
}

/** "42261111…" → "4226 1111 …" (como impresso na nota). */
export function formatarChave(chave: string): string {
  return chave.replace(/(\d{4})(?=\d)/g, '$1 ')
}

/** "12345678000190" → "12.345.678/0001-90". */
export function formatarCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
