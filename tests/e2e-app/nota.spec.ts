// Nota fiscal: colar o link da página da nota (SEFAZ falsa), conferir e confirmar.
import { LINKS } from '../apoio/sefaz-falsa.ts'
import { CATEGORIA, api, expect, test } from './apoio.ts'

test('lê a nota, casa a água anotada e confirma com o preço pago e o cheio', async ({ page }) => {
  const { id: mercadoId } = await api<{ id: number }>('POST', '/api/mercados', { nome: 'Mercado A' })
  const { id: compraId } = await api<{ id: number }>('POST', '/api/compras', { mercadoId })
  await api('POST', `/api/compras/${compraId}/itens`, {
    nome: 'Água sem gás',
    categoriaId: CATEGORIA.bebidas,
    precoUnitario: 149,
    quantidade: 2,
    unidade: 'un',
  })
  await api('POST', `/api/compras/${compraId}/finalizar`, {})

  await page.goto(`/compras/${compraId}`)
  await page.getByRole('button', { name: 'Ler nota fiscal' }).click()
  // Sem câmera no navegador de teste: o leitor oferece colar o link.
  await page.getByPlaceholder('ou cole o link da nota').fill(LINKS.simples)
  await page.getByRole('button', { name: 'Ler', exact: true }).click()

  const nota = page.locator('section.nota')
  await expect(nota).toContainText('AGUA MINERAL MARCA X 500ML S GAS PET')
  await expect(nota).toContainText('(de R$ 1,69, −R$ 0,40)')
  // As outras linhas da nota ficam de fora.
  for (const ordem of [2, 3]) await page.getByLabel(`Item da linha ${ordem}`).selectOption('ignorar')
  await page.getByRole('button', { name: 'Confirmar conferência' }).click()
  await expect(nota).toContainText('conferida ✓')

  const resumo = await api<{ itens: { nome: string; precoUnitario: number; precoCheio: number | null }[] }>(
    'GET',
    `/api/compras/${compraId}`,
  )
  expect(resumo.itens.map((i) => [i.nome, i.precoUnitario, i.precoCheio])).toEqual([['Água sem gás', 149, 169]])
})

test('compra com total da nota: total oficial, itens e categorias com a diferença', async ({ page }) => {
  const { id: mercadoId } = await api<{ id: number }>('POST', '/api/mercados', { nome: 'Mercado A' })
  const { id } = await api<{ id: number }>('POST', '/api/compras', { mercadoId })
  await api('POST', `/api/compras/${id}/itens`, { nome: 'Arroz', categoriaId: CATEGORIA.mercearia, precoUnitario: 2000, quantidade: 1, unidade: 'un' })
  await api('POST', `/api/compras/${id}/itens`, { nome: 'Banana', categoriaId: CATEGORIA.hortifruti, precoUnitario: 1000, quantidade: 1, unidade: 'un' })
  await api('POST', `/api/compras/${id}/finalizar`, { totalNota: 2800 })

  await page.goto(`/compras/${id}`)
  const destaque = page.locator('.destaque')
  await expect(destaque).toContainText('Total da nota')
  await expect(destaque).toContainText('R$ 28,00')
  await expect(destaque).toContainText('Itens: R$ 30,00')
  const categorias = page.locator('ul.categorias')
  await expect(categorias).toContainText('Mercearia')
  await expect(categorias).toContainText('Hortifruti')
  await expect(categorias).toContainText('Diferença da nota')
})
