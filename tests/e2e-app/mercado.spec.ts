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
