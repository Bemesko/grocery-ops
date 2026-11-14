// Lista: anotar itens, prioridade, quantidade e arrastar para comprado/tirar.
import { CATEGORIA, api, expect, test } from './apoio.ts'

test('adiciona um item novo escolhendo a categoria', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Adicionar item…').fill('Abacaxi')
  await page.getByRole('button', { name: /Adicionar “Abacaxi”/ }).click()
  await page.getByRole('radio', { name: 'Hortifruti' }).click()
  const secao = page.locator('section', { has: page.getByRole('heading', { name: 'Hortifruti' }) })
  await expect(secao.getByText('Abacaxi')).toBeVisible()
})

test('adiciona um item que já existe pela sugestão', async ({ page }) => {
  const { id } = await api<{ id: number }>('POST', '/api/lista', { nome: 'Leite integral', categoriaId: CATEGORIA.laticinios })
  await api('DELETE', `/api/lista/${id}`)
  await page.goto('/')
  await page.getByPlaceholder('Adicionar item…').fill('leite')
  await page.getByRole('button', { name: 'Leite integral' }).click()
  await expect(page.locator('ul.lista').getByText('Leite integral')).toBeVisible()
})

test('prioridade e quantidade', async ({ page }) => {
  await api('POST', '/api/lista', { nome: 'Café', categoriaId: CATEGORIA.mercearia })
  await page.goto('/')
  const prioridade = page.getByRole('button', { name: 'Marcar como prioritário' })
  await prioridade.click()
  await expect(page.getByRole('button', { name: 'Tirar prioridade' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByText('Café', { exact: true }).click()
  const quantidade = page.getByPlaceholder('Quantidade (ex.: 2, 1 kg)')
  await quantidade.fill('2 pacotes')
  await quantidade.blur()
  await expect(page.getByText('· 2 pacotes')).toBeVisible()
})

async function arrastar(page: import('@playwright/test').Page, texto: string, direcao: 1 | -1) {
  const linha = page.locator('li.arrastavel', { hasText: texto }).locator('.frente')
  const caixa = (await linha.boundingBox())!
  const y = caixa.y + caixa.height / 2
  // Começa perto da borda oposta, para o gesto (60% da largura) ficar dentro da tela.
  const inicio = caixa.x + caixa.width * (direcao === 1 ? 0.2 : 0.8)
  await page.mouse.move(inicio, y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(inicio + direcao * caixa.width * 0.06 * i, y)
  await page.mouse.up()
}

test('arrastar para a direita marca como comprado; para a esquerda tira da lista', async ({ page }) => {
  await api('POST', '/api/lista', { nome: 'Arroz', categoriaId: CATEGORIA.mercearia })
  await api('POST', '/api/lista', { nome: 'Feijão', categoriaId: CATEGORIA.mercearia })
  await page.goto('/')
  await arrastar(page, 'Arroz', 1)
  await expect(page.locator('li.arrastavel', { hasText: 'Arroz' })).toHaveCount(0)
  // O aviso só aparece quando o servidor respondeu; antes disso um novo gesto é ignorado.
  await expect(page.getByText('Arroz comprado')).toBeVisible()
  await arrastar(page, 'Feijão', -1)
  await expect(page.locator('li.arrastavel', { hasText: 'Feijão' })).toHaveCount(0)
  await expect(page.getByText('Feijão saiu da lista')).toBeVisible()
  const lista = await api<{ itens: unknown[] }>('GET', '/api/lista')
  expect(lista.itens).toHaveLength(0)
})
