// Ajustes e Gastos: saldo do VR, orçamento da semana, gastos por categoria e o modo
// "ocultar valores".
import { CATEGORIA, api, expect, test } from './apoio.ts'

async function compraFinalizada(nome: string, preco: number, categoriaId: number) {
  const { id: mercadoId } = await api<{ id: number }>('POST', '/api/mercados', { nome: `Mercado ${nome}` })
  const { id } = await api<{ id: number }>('POST', '/api/compras', { mercadoId })
  await api('POST', `/api/compras/${id}/itens`, { nome, categoriaId, precoUnitario: preco, quantidade: 1, unidade: 'un' })
  await api('POST', `/api/compras/${id}/finalizar`, {})
}

test('informar o saldo mostra o orçamento da semana', async ({ page }) => {
  await page.goto('/ajustes')
  await page.getByPlaceholder('Saldo de hoje (R$)').fill('1000,00')
  await page.getByRole('button', { name: 'Ajustar' }).click()
  const saldo = page.locator('#saldo')
  await expect(saldo).toContainText('Saldo agora')
  await expect(saldo).toContainText('R$ 1.000,00')
  await page.goto('/')
  await expect(page.locator('.cabecalho')).toContainText('Semana: R$')
})

test('gastos do mês por categoria', async ({ page }) => {
  await compraFinalizada('Detergente', 2_500, 7)
  await compraFinalizada('Arroz', 1_000, CATEGORIA.mercearia)
  await page.goto('/gastos')
  await expect(page.locator('main')).toContainText('R$ 35,00')
  await expect(page.locator('main')).toContainText('Limpeza')
  await expect(page.locator('main')).toContainText('Mercearia')
})

test('ocultar valores esconde os R$ e fica lembrado ao recarregar', async ({ page }) => {
  await compraFinalizada('Arroz', 1_000, CATEGORIA.mercearia)
  await page.goto('/gastos')
  await expect(page.locator('main')).toContainText('R$ 10,00')
  await page.getByRole('button', { name: 'Ocultar valores' }).click()
  await expect(page.locator('main')).not.toContainText('R$ 10,00')
  await expect(page.locator('main')).toContainText('R$ •••••')
  await page.reload()
  await expect(page.locator('main')).toContainText('R$ •••••')
  await page.getByRole('button', { name: 'Mostrar valores' }).click()
  await expect(page.locator('main')).toContainText('R$ 10,00')
})
