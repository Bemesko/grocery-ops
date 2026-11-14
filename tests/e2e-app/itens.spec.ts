// Gestão de itens: outros nomes e apagar.
import { CATEGORIA, api, expect, test } from './apoio.ts'

test('outros nomes do item e apagar um item sem compras', async ({ page }) => {
  const { itemId } = await api<{ itemId: number }>('POST', '/api/lista', { nome: 'Aipim', categoriaId: CATEGORIA.hortifruti })
  await page.goto(`/itens/${itemId}`)
  await page.getByPlaceholder('ex.: mandioca').fill('mandioca')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tirar Mandioca' })).toBeVisible()

  // A busca da lista acha o item pelo outro nome.
  await page.goto('/')
  await page.getByPlaceholder('Adicionar item…').fill('mandi')
  await expect(page.locator('.sugestoes').getByText('Aipim')).toBeVisible()

  await page.goto(`/itens/${itemId}`)
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Apagar item' }).click()
  await expect(page).toHaveURL(/\/itens$/)
  const itens = await api<{ id: number }[]>('GET', '/api/itens')
  expect(itens.find((i) => i.id === itemId)).toBeUndefined()
})
