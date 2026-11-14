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
