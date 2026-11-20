// Mercado: preparar a ida, começar, registrar preços (por unidade e por kg) e finalizar.
import { CATEGORIA, api, expect, test } from './apoio.ts'

test('da lista ao resumo da compra', async ({ page }) => {
  await api('POST', '/api/mercados', { nome: 'Mercado A' })
  await api('POST', '/api/lista', { nome: 'Leite integral', categoriaId: CATEGORIA.laticinios })
  await api('POST', '/api/lista', { nome: 'Banana', categoriaId: CATEGORIA.hortifruti })

  await page.goto('/')
  await page.getByRole('button', { name: /Preparar ida/ }).click()
  await page.getByRole('button', { name: 'Começar' }).click()
  await expect(page).toHaveURL(/\/mercado$/)

  // Por unidade.
  await page.locator('li.pendente', { hasText: 'Leite integral' }).click()
  await page.locator('#preco').fill('4,59')
  await page.getByRole('button', { name: 'Mais' }).click()
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.locator('li.pego', { hasText: 'Leite integral' })).toBeVisible()

  // Por kg.
  await page.locator('li.pendente', { hasText: 'Banana' }).click()
  await page.getByRole('button', { name: 'Por kg' }).click()
  await page.locator('#preco').fill('5,99')
  await page.locator('#peso').fill('1,234')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.locator('li.pego', { hasText: 'Banana' })).toBeVisible()

  await page.getByRole('button', { name: 'Finalizar compra' }).click()
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await expect(page).toHaveURL(/\/compras\/\d+/)
  // 2 × 4,59 + 1,234 × 5,99 = 9,18 + 7,39
  await expect(page.locator('.destaque')).toContainText('R$ 16,57')
})

test('preço vazio usa o da última vez; "informar depois" marca a linha; tocar fora pergunta', async ({ page }) => {
  const { id: mercadoId } = await api<{ id: number }>('POST', '/api/mercados', { nome: 'Mercado A' })
  // Uma compra anterior deixa a referência do leite (4,59) neste mercado.
  const anterior = await api<{ id: number }>('POST', '/api/compras', { mercadoId })
  await api('POST', `/api/compras/${anterior.id}/itens`, {
    nome: 'Leite',
    categoriaId: CATEGORIA.laticinios,
    precoUnitario: 459,
    quantidade: 1,
    unidade: 'un',
  })
  await api('POST', `/api/compras/${anterior.id}/finalizar`, {})
  await api('POST', '/api/lista', { nome: 'Leite' })
  await api('POST', '/api/lista', { nome: 'Queijo', categoriaId: CATEGORIA.laticinios })
  await api('POST', '/api/compras', { mercadoId, levarTudo: true })

  await page.goto('/mercado')
  // Tocar fora da folha pergunta; cancelar mantém a folha aberta.
  await page.locator('li.pendente', { hasText: 'Leite' }).click()
  page.once('dialog', (d) => d.dismiss())
  await page.mouse.click(10, 10)
  await expect(page.getByRole('heading', { name: 'Leite' })).toBeVisible()
  await expect(page.getByText('Vazio = R$ 4,59')).toBeVisible()
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.locator('li.pego', { hasText: 'Leite' })).toContainText('R$ 4,59')

  // Sem preço: entra marcada.
  await page.locator('li.pendente', { hasText: 'Queijo' }).click()
  await page.getByText('Informar o preço depois').click()
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.locator('li.pego', { hasText: 'Queijo' })).toContainText('sem preço')

  await page.getByRole('button', { name: 'Finalizar compra' }).click()
  await expect(page.locator('.folha-nome')).toContainText('1 item está sem preço')
})

test('preço digitado da direita para a esquerda', async ({ page }) => {
  const { id: mercadoId } = await api<{ id: number }>('POST', '/api/mercados', { nome: 'Mercado A' })
  await api('POST', '/api/lista', { nome: 'Pão', categoriaId: CATEGORIA.padaria })
  await api('POST', '/api/compras', { mercadoId, levarTudo: true })
  await page.goto('/mercado')
  await page.locator('li.pendente', { hasText: 'Pão' }).click()
  const preco = page.locator('#preco')
  await preco.pressSequentially('1')
  await expect(preco).toHaveValue('0,01')
  await preco.pressSequentially('49')
  await expect(preco).toHaveValue('1,49')
})

test('preparar ida: comparação recolhível, par a par com o mais barato e por kg (#43, #44, #12)', async ({ page }) => {
  const mercados: Record<string, number> = {}
  for (const nome of ['Atacado', 'Padaria', 'Variedade']) {
    mercados[nome] = (await api<{ id: number }>('POST', '/api/mercados', { nome })).id
  }
  // Preços anteriores: café (1 kg no atacado, 500 g na variedade) e pão (padaria e variedade).
  const compras: [string, { nome: string; preco: number; embalagem?: string; categoriaId: number }[]][] = [
    ['Atacado', [{ nome: 'Café', preco: 4_000, embalagem: '1 kg', categoriaId: CATEGORIA.mercearia }]],
    ['Padaria', [{ nome: 'Pão', preco: 1_000, categoriaId: CATEGORIA.padaria }]],
    [
      'Variedade',
      [
        { nome: 'Café', preco: 2_200, embalagem: '500 g', categoriaId: CATEGORIA.mercearia },
        { nome: 'Pão', preco: 1_200, categoriaId: CATEGORIA.padaria },
      ],
    ],
  ]
  for (const [mercado, itens] of compras) {
    const { id } = await api<{ id: number }>('POST', '/api/compras', { mercadoId: mercados[mercado] })
    for (const i of itens) {
      await api('POST', `/api/compras/${id}/itens`, { ...i, precoUnitario: i.preco, quantidade: 1, unidade: 'un' })
    }
    await api('POST', `/api/compras/${id}/finalizar`, {})
  }
  await api('POST', '/api/lista', { nome: 'Café' })
  await api('POST', '/api/lista', { nome: 'Pão' })
  await api('POST', '/api/lista/selecao', { modo: 'todos' })

  await page.goto('/')
  await page.getByRole('button', { name: /Preparar ida/ }).click()
  const rodape = page.locator('footer.rodape')
  // Fechado: só o mais barato, com o botão de começar.
  await expect(rodape.getByRole('button', { name: 'Começar' })).toHaveCount(1)
  await expect(rodape).toContainText('Atacado')
  await expect(rodape).not.toContainText('Variedade')

  await rodape.getByRole('button', { name: /Todos os 3 mercados/ }).click()
  await expect(rodape.getByRole('button', { name: 'Começar' })).toHaveCount(3)
  const comparacao = rodape.getByRole('list', { name: 'Comparação com o mais barato' })
  // Café na embalagem habitual (1 kg, a da primeira compra): variedade 500 g a 22,00 → 44,00.
  await expect(comparacao).toContainText('Variedade × Atacado: 1 item, R$ 44,00 × R$ 40,00 (+10%)')
  await expect(comparacao).not.toContainText('Padaria ×')
  await expect(rodape).toContainText('Estimado por kg/L (embalagem de outro tamanho): Variedade em 1 item.')

  // A escolha fica lembrada no aparelho.
  await page.reload()
  await page.getByRole('button', { name: /Preparar ida/ }).click()
  await expect(rodape.getByRole('button', { name: 'Começar' })).toHaveCount(3)
  await rodape.getByRole('button', { name: 'Mostrar menos ▴' }).click()
  await expect(rodape.getByRole('button', { name: 'Começar' })).toHaveCount(1)
})

test('mexer na lista durante a compra: prioridade, tirar, levar nesta ida e pôr na lista (#45, #69)', async ({ page }) => {
  await api('POST', '/api/mercados', { nome: 'Mercado A' })
  await api('POST', '/api/lista', { nome: 'Leite integral', categoriaId: CATEGORIA.laticinios })
  await api('POST', '/api/lista', { nome: 'Banana', categoriaId: CATEGORIA.hortifruti })
  await api('POST', '/api/lista', { nome: 'Sabão', categoriaId: CATEGORIA.outros })

  await page.goto('/')
  await page.getByRole('button', { name: /Preparar ida/ }).click()
  for (const nome of ['Leite integral', 'Banana']) {
    await page.locator('li.arrastavel', { hasText: nome }).getByRole('checkbox').check() // Sabão fica de fora desta ida
  }
  await page.getByRole('button', { name: 'Começar' }).click()
  await expect(page).toHaveURL(/\/mercado$/)

  // Prioridade e tirar da lista, sem sair do Mercado.
  await page.getByRole('button', { name: 'Marcar como prioridade' }).first().click()
  await expect(page.locator('li.pendente.prioritario')).toHaveCount(1)
  await page.getByRole('button', { name: 'Tirar Banana da lista' }).click()
  await expect(page.locator('li.pendente', { hasText: 'Banana' })).toHaveCount(0)

  // O que ficou de fora da ida pode ser levado nela.
  await page.getByRole('button', { name: /Também na lista/ }).click()
  await page.getByRole('button', { name: 'Levar Sabão nesta ida' }).click()
  await expect(page.locator('li.pendente', { hasText: 'Sabão' })).toBeVisible()

  // Só pôr na lista: entra na ida sem ir para o carrinho.
  await page.getByRole('button', { name: 'Item fora da lista' }).click()
  await page.getByLabel(/só pôr na lista/).check()
  await page.getByPlaceholder('Nome do item').fill('Pilha')
  await page.getByRole('button', { name: /Pilha/ }).first().click()
  await expect(page.locator('li.pendente', { hasText: 'Pilha' })).toBeVisible()

  // Um item que já estava na lista não vira "fora da lista" ao ser comprado.
  await page.locator('li.pendente', { hasText: 'Pilha' }).click()
  await page.locator('#preco').fill('10,00')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.locator('li.pego', { hasText: 'Pilha' })).toBeVisible()
  await expect(page.locator('li.pego .selo.alerta')).toHaveCount(0)

  // Um item de fora da lista fica com o selo amarelo.
  await page.getByRole('button', { name: 'Item fora da lista' }).click()
  await page.getByPlaceholder('Nome do item').fill('Chiclete')
  await page.getByRole('button', { name: /Chiclete/ }).first().click()
  await page.locator('#preco').fill('3,00')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.locator('li.pego', { hasText: 'Chiclete' }).locator('.selo.alerta')).toHaveText('fora da lista')
})
