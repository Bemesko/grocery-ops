// Compra manual (#65): só mercado, data e total.
import { api, expect, test } from './apoio.ts'

test('registra uma compra só com o total e ela aparece em Compras e Gastos', async ({ page }) => {
  await api('POST', '/api/mercados', { nome: 'Padaria' })
  await page.goto('/compras')
  await page.getByRole('button', { name: /Compra sem itens/ }).click()
  await page.getByLabel('Total (R$)').fill('45,50')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page).toHaveURL(/\/compras\/\d+/)
  await expect(page.locator('.destaque')).toContainText('R$ 45,50')

  await page.goto('/compras')
  await expect(page.locator('li', { hasText: 'Padaria' })).toContainText('só o total')

  await page.goto('/gastos')
  await expect(page.getByText('Compras sem itens')).toBeVisible()
})
