// Contrato com o Home Assistant (falso) na sincronização da lista da Alexa: o que o app envia
// e como reage a cada resposta.
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import * as contrato from '../../shared/contratos/api.ts'
import { iniciarAmbiente, type Ambiente } from '../apoio/ambiente.ts'
import { clienteApi, conforme } from '../apoio/api.ts'
import { ENTIDADE_HA, TOKEN_HA } from '../apoio/ha-falso.ts'

let amb: Ambiente
let api: ReturnType<typeof clienteApi>

before(async () => {
  amb = await iniciarAmbiente()
  api = clienteApi(amb.url)
})
after(() => amb.encerrar())
beforeEach(() => amb.limpar())

const sincronizar = async () => conforme(contrato.estadoAlexa, await api.post('/api/alexa/sincronizar'))

describe('Alexa → lista', () => {
  it('pede os pendentes com o token e a entidade, importa e marca como concluído', async () => {
    await api.post('/api/lista', { nome: 'Tomate', categoriaId: 1 })
    amb.ha.itens.push(
      { uid: 'u1', summary: 'tomates', status: 'needs_action' },
      { uid: 'u2', summary: 'abacate', status: 'needs_action' },
      { uid: 'u3', summary: 'já comprado', status: 'completed' },
    )
    const estado = await sincronizar()
    assert.deepEqual([estado.ligada, estado.importados, estado.erro], [true, 2, null])

    const leitura = amb.ha.chamadas[0]!
    assert.equal(leitura.metodo, 'POST')
    assert.equal(leitura.caminho, '/api/services/todo/get_items?return_response')
    assert.equal(leitura.autorizacao, `Bearer ${TOKEN_HA}`)
    assert.deepEqual(leitura.corpo, { entity_id: ENTIDADE_HA, status: ['needs_action'] })
    const concluidos = amb.ha.chamadas.filter((c) => c.caminho === '/api/services/todo/update_item')
    assert.deepEqual(
      concluidos.map((c) => c.corpo).sort((a, b) => String(a.item).localeCompare(String(b.item))),
      [
        { entity_id: ENTIDADE_HA, item: 'u1', status: 'completed' },
        { entity_id: ENTIDADE_HA, item: 'u2', status: 'completed' },
      ],
    )

    const lista = conforme(contrato.respostaLista, await api.get('/api/lista'))
    // "tomates" casou com o Tomate que já estava aberto (não duplica); abacate é novo em Outros.
    assert.deepEqual(
      lista.itens.map((i) => [i.nome, i.categoriaId]).sort(),
      [
        ['Abacate', 12],
        ['Tomate', 1],
      ],
    )
    assert.equal(lista.itens.find((i) => i.nome === 'Abacate')!.origem, 'alexa')
  })

  it('não importa de novo um item já importado, mesmo se o HA voltar a mostrá-lo', async () => {
    amb.ha.itens.push({ uid: 'u1', summary: 'abacate', status: 'needs_action' })
    await sincronizar()
    amb.ha.itens[0]!.status = 'needs_action' // o HA "esqueceu" que concluiu
    const segunda = await sincronizar()
    assert.equal(segunda.importados, 0)
    const lista = conforme(contrato.respostaLista, await api.get('/api/lista'))
    assert.equal(lista.itens.length, 1)
  })

  it('token recusado e entidade errada viram mensagens que dizem o que conferir', async () => {
    amb.ha.modo = '401'
    assert.match((await sincronizar()).erro ?? '', /HA_TOKEN/)
    amb.ha.modo = '400'
    assert.match((await sincronizar()).erro ?? '', /HA_TODO_ENTITY/)
    amb.ha.modo = 'ok'
    assert.equal((await sincronizar()).erro, null)
    conforme(contrato.estadoAlexa, await api.get('/api/alexa'))
  })

  it('falhas seguidas são contadas e o último sucesso é lembrado (#74)', async () => {
    const ok = await sincronizar()
    assert.deepEqual([ok.erro, ok.falhasSeguidas], [null, 0])
    assert.ok(ok.ultimoSucessoEm)
    amb.ha.modo = '401'
    await sincronizar()
    const falha = await sincronizar()
    assert.equal(falha.falhasSeguidas, 2)
    assert.equal(falha.ultimoSucessoEm, ok.ultimoSucessoEm)
    amb.ha.modo = 'ok'
    const volta = await sincronizar()
    assert.deepEqual([volta.erro, volta.falhasSeguidas], [null, 0])
    assert.notEqual(volta.ultimoSucessoEm, null)
  })
})
