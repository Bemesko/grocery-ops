// Monolito: SPA (ssr: false) + API no mesmo servidor Nitro, com Postgres (DATABASE_URL).
// O service worker cacheia a casca; os dados vêm sempre da API (sem modo offline na v1).
// A rota / é pré-renderizada para virar index.html e entrar no precache.
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'Grocery Ops',
      htmlAttrs: { lang: 'pt-BR' },
      meta: [{ name: 'description', content: 'Lista de compras e acompanhamento do carrinho no mercado' }],
    },
  },

  // NUXT_APP_VERSION no container (Dockerfile, build-arg VERSION do release.yaml)
  runtimeConfig: {
    appVersion: 'dev',
  },

  nitro: {
    preset: 'node-server',
    prerender: { routes: ['/'] },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Grocery Ops',
      short_name: 'Grocery',
      description: 'Lista de compras e acompanhamento do carrinho no mercado',
      lang: 'pt-BR',
      display: 'standalone',
      start_url: '/',
      theme_color: '#2f855a',
      background_color: '#ffffff',
    },
    // Ícones gerados no build a partir de public/icon.svg (@vite-pwa/assets-generator).
    pwaAssets: {
      image: 'public/icon.svg',
      preset: 'minimal-2023',
      overrideManifestIcons: true,
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//, /^\/healthz$/],
      globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
    },
    client: {
      installPrompt: true,
    },
  },
})
