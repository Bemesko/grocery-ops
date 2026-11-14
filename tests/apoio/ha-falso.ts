// Home Assistant falso para os testes: imita a API REST de tarefas (todo.get_items com
// return_response e todo.update_item) e registra cada chamada, para os testes de contrato
// conferirem o que o app envia.
import http from 'node:http'
import type { AddressInfo } from 'node:net'

export const TOKEN_HA = 'token-de-teste'
export const ENTIDADE_HA = 'todo.lista_de_teste'

export interface ItemHa {
  uid: string
  summary: string
  status: 'needs_action' | 'completed'
}

export interface ChamadaHa {
  metodo: string
  caminho: string
  autorizacao: string | undefined
  corpo: Record<string, unknown>
}

export interface HaFalso {
  url: string
  itens: ItemHa[]
  chamadas: ChamadaHa[]
  /** ok: responde normal; 401: token recusado; 400: entidade recusada. */
  modo: 'ok' | '401' | '400'
  fechar(): Promise<void>
}

export async function iniciarHaFalso(): Promise<HaFalso> {
  const estado: Omit<HaFalso, 'url' | 'fechar'> = { itens: [], chamadas: [], modo: 'ok' }
  const servidor = http.createServer((req, res) => {
    let texto = ''
    req.on('data', (c) => (texto += c))
    req.on('end', () => {
      const corpo = texto ? (JSON.parse(texto) as Record<string, unknown>) : {}
      estado.chamadas.push({ metodo: req.method ?? '', caminho: req.url ?? '', autorizacao: req.headers.authorization, corpo })
      const responder = (status: number, dados: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(dados))
      }
      if (estado.modo === '401' || req.headers.authorization !== `Bearer ${TOKEN_HA}`) {
        return responder(401, { message: 'Unauthorized' })
      }
      if (estado.modo === '400' || corpo.entity_id !== ENTIDADE_HA) return responder(400, { message: 'Entity not found' })
      if (req.method === 'POST' && req.url === '/api/services/todo/get_items?return_response') {
        const status = (corpo.status as string[] | undefined) ?? ['needs_action', 'completed']
        const items = estado.itens.filter((i) => status.includes(i.status))
        return responder(200, { changed_states: [], service_response: { [ENTIDADE_HA]: { items } } })
      }
      if (req.method === 'POST' && req.url === '/api/services/todo/update_item') {
        const item = estado.itens.find((i) => i.uid === corpo.item || i.summary === corpo.item)
        if (!item) return responder(400, { message: 'Item not found' })
        if (corpo.status === 'completed' || corpo.status === 'needs_action') item.status = corpo.status
        return responder(200, [])
      }
      responder(404, { message: 'Not found' })
    })
  })
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok))
  const { port } = servidor.address() as AddressInfo
  const ha = estado as HaFalso
  ha.url = `http://127.0.0.1:${port}`
  ha.fechar = () => new Promise((ok) => servidor.close(() => ok()))
  return ha
}
