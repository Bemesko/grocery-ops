// Playwright no celular (375×812): os fluxos principais do app contra o build de produção,
// com Postgres e o HA e a SEFAZ falsos (tests/apoio). Rode com `make e2e-app`.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  globalSetup: './preparar.ts',
  // Um banco só para a rodada: os cenários limpam os dados antes de cada teste.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: [['list'], ['html', { outputFolder: 'relatorio', open: 'never' }]],
  outputDir: 'resultados',
  use: {
    ...devices['Pixel 7'],
    viewport: { width: 375, height: 812 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
