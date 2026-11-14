// Sobe o ambiente (banco novo, HA e SEFAZ falsos, build de produção) uma vez para a rodada
// do Playwright. Os cenários recebem o endereço do app e do banco por variáveis de ambiente.
import { iniciarAmbiente } from '../apoio/ambiente.ts'

export default async function preparar() {
  const amb = await iniciarAmbiente()
  process.env.E2E_APP_URL = amb.url
  process.env.E2E_BANCO_URL = amb.urlBanco
  return () => amb.encerrar()
}
