// Lista de compras da Alexa → lista do app (docs/produto-v1.md, "Lista da Alexa"). A Alexa
// sincroniza com o Home Assistant, que expõe a lista como uma entidade de tarefas (todo.*).
// O app lê os itens pendentes pela API REST do HA, põe cada um na lista e o marca como
// concluído lá. Só nesse sentido: a lista do app é a de verdade.
//
// Configuração (Secret opcional `grocery-ops-alexa`): HA_URL, HA_TOKEN e HA_TODO_ENTITY.
// O entity_id da lista contém o e-mail da conta da Alexa: fica no Secret, nunca no repo.
import type { EstadoAlexa } from '../../shared/types/api'
import { itemParaTexto } from '../../shared/utils/itemDoTexto'
import type { Sql } from './db'

const TEMPO_LIMITE = 10_000
/** Chave do advisory lock: uma sincronização por vez, mesmo com mais de um pod. */
const TRAVA = 4_200_001

interface ConfigAlexa {
  url: string
  token: string
  entidade: string
}

export function configAlexa(): ConfigAlexa | null {
  const url = process.env.HA_URL?.trim().replace(/\/+$/, '')
  const token = process.env.HA_TOKEN?.trim()
  const entidade = process.env.HA_TODO_ENTITY?.trim()
  return url && token && entidade ? { url, token, entidade } : null
}

const estado: EstadoAlexa = { ligada: false, ultimaEm: null, importados: 0, erro: null }

export function estadoAlexa(): EstadoAlexa {
  return { ...estado, ligada: Boolean(configAlexa()) }
}

interface ItemHa {
  uid: string
  summary: string
}

async function chamarHa(config: ConfigAlexa, servico: string, corpo: Record<string, unknown>, resposta = false) {
  let r: Response
  try {
    r = await fetch(`${config.url}/api/services/todo/${servico}${resposta ? '?return_response' : ''}`, {
      method: 'POST',
      signal: AbortSignal.timeout(TEMPO_LIMITE),
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: config.entidade, ...corpo }),
    })
  } catch {
    throw new Error('Não consegui falar com o Home Assistant: confira HA_URL e se ele está no ar')
  }
  if (r.status === 401 || r.status === 403) throw new Error('O Home Assistant recusou o token: confira HA_TOKEN')
  if (r.status === 400 || r.status === 404) {
    throw new Error(`O Home Assistant não aceitou todo.${servico}: confira HA_TODO_ENTITY (a lista da Alexa)`)
  }
  if (!r.ok) throw new Error(`O Home Assistant respondeu ${r.status} em todo.${servico}`)
  return resposta ? ((await r.json()) as Record<string, unknown>) : null
}

/** Itens pendentes da lista (o formato da resposta mudou entre versões do HA: aceita os dois). */
async function pendentes(config: ConfigAlexa): Promise<ItemHa[]> {
  const r = await chamarHa(config, 'get_items', { status: ['needs_action'] }, true)
  const porEntidade = ((r?.service_response as Record<string, unknown>) ?? r ?? {}) as Record<string, { items?: unknown }>
  const itens = (porEntidade[config.entidade]?.items ?? []) as { uid?: unknown; summary?: unknown }[]
  return itens
    .filter((i) => typeof i.uid === 'string' && typeof i.summary === 'string' && i.summary.trim())
    .map((i) => ({ uid: i.uid as string, summary: (i.summary as string).trim().slice(0, 80) }))
}

/**
 * Uma rodada: importa os itens pendentes ainda não importados e marca como concluídos no HA
 * os já importados. Devolve o estado (também guardado para a tela de Ajustes).
 */
export async function sincronizarAlexa(sql: Sql): Promise<EstadoAlexa> {
  const config = configAlexa()
  if (!config) return estadoAlexa()
  try {
    const itensHa = await pendentes(config)
    const novos = await sql.begin(async (tx) => {
      const [trava] = await tx`select pg_try_advisory_xact_lock(${TRAVA}) as ok`
      if (!trava?.ok) return null
      const ja = new Set(
        (await tx`select uid from alexa_importado where uid in ${tx(itensHa.map((i) => i.uid).concat(''))}`).map(
          (r) => r.uid as string,
        ),
      )
      const faltam = itensHa.filter((i) => !ja.has(i.uid))
      if (!faltam.length) return 0
      const itensApp = (await tx`select id, nome from item`) as unknown as { id: number; nome: string }[]
      // Item que o app não conhece entra em "Outros" (ou na última categoria, se não houver).
      const [categoria] = await tx`
        select id from categoria order by (lower(nome) = 'outros') desc, ordem desc limit 1
      `
      for (const i of faltam) {
        const conhecido = itemParaTexto(i.summary, itensApp)
        const item = conhecido
          ? conhecido
          : await resolverItem(tx, { nome: i.summary, categoriaId: categoria!.id as number })
        if (!conhecido) itensApp.push({ id: item.id, nome: item.nome })
        const linha = await adicionarNaLista(tx, item.id, { origem: 'alexa' })
        await tx`
          insert into alexa_importado (uid, lista_item_id) values (${i.uid}, ${linha.id})
          on conflict (uid) do nothing
        `
      }
      return faltam.length
    })
    if (novos === null) return estadoAlexa()

    // Marca como concluído no HA o que já foi importado (inclusive o que falhou antes).
    const pendentesNoHa = new Set(itensHa.map((i) => i.uid))
    const aConcluir = await sql`select uid from alexa_importado where not concluido_no_ha`
    for (const { uid } of aConcluir) {
      if (pendentesNoHa.has(uid as string)) await chamarHa(config, 'update_item', { item: uid, status: 'completed' })
      await sql`update alexa_importado set concluido_no_ha = true where uid = ${uid as string}`
    }

    Object.assign(estado, { ultimaEm: new Date().toISOString(), importados: novos, erro: null })
    if (novos) {
      metricas.itensAlexa.add(novos)
      log('info', 'alexa sincronizada', { importados: novos })
    }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e)
    Object.assign(estado, { ultimaEm: new Date().toISOString(), importados: 0, erro: mensagem })
    log('warn', 'alexa: sincronização falhou', { erro: mensagem })
  }
  return estadoAlexa()
}
