// Parser de CSV com aspas (RFC 4180). O separador é detectado no cabeçalho: `;` (Excel em
// pt-BR) ou `,`.
export function lerCsv(conteudo: string): string[][] {
  const texto = conteudo.replace(/^﻿/, '')
  const primeiraLinha = texto.split(/\r?\n/, 1)[0] ?? ''
  const sep = (primeiraLinha.match(/;/g)?.length ?? 0) > (primeiraLinha.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') {
        aspas = false
      } else {
        campo += c
      }
    } else if (c === '"') {
      aspas = true
    } else if (c === sep) {
      linha.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else {
      campo += c
    }
  }
  if (campo || linha.length) {
    linha.push(campo)
    linhas.push(linha)
  }
  return linhas.filter((l) => l.some((c) => c.trim()))
}
