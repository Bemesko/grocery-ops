# grocery-ops

PWA de lista de compras e acompanhamento do carrinho no mercado. Roda no cluster k3s do homelab, em `https://grocery-ops.<sua-tailnet>`, e pode ser instalado no celular.

**Estado:** v1 conforme [docs/produto-v1.md](docs/produto-v1.md): lista compartilhada, preparar a ida, modo mercado com budget do VR, resumo da compra, gastos do mês e importação de histórico por CSV.

## Stack

- **Nuxt 4 como monolito:** SPA (`ssr: false`) e API (Nitro, `server/api`) no mesmo processo Node e na mesma imagem.
- **PWA** com [`@vite-pwa/nuxt`](https://vite-pwa-org.netlify.app/frameworks/nuxt):
  - manifest e service worker com precache da casca (abre sem sinal no mercado);
  - ícones gerados no build a partir de [`public/icon.svg`](public/icon.svg).
- **Postgres** (CloudNativePG no cluster, [deploy/base/database.yaml](deploy/base/database.yaml)); o schema é migrado pelo app na subida ([server/db/migracoes.ts](server/db/migracoes.ts)).

```
app/            front (Vue): app.vue, pages/
server/routes/  /healthz (probes do Kubernetes e e2e)
server/api/     API (lista, itens, compras, saldo, gastos, importação)
server/db/      migrações do Postgres
shared/         código usado no front e na API (texto, busca, budget, tipos)
docs/           especificação da v1 e modelo de CSV
public/         estáticos (icon.svg → ícones do PWA)
deploy/         kustomize que o cluster sincroniza (base = CI, overlays/tailscale = notebook)
```

## Desenvolvimento (WSL)

Não precisa instalar Node: o `npm` roda via Docker na mesma imagem do `Dockerfile`, fixada por digest.

```bash
make deps && pre-commit install   # uma vez: ferramentas de validação
make install                      # npm ci
make db                           # Postgres local em container (dados em .data/postgres)
make dev                          # http://localhost:3000 (sobe o make db)
make run                          # imagem de produção em http://localhost:8080 (raiz read-only, como no cluster)
make test                         # pre-commit + kubeconform/kube-linter de deploy/
```

O service worker só é gerado no build de produção. Para testar a instalação do PWA, use `make run` ou o próprio cluster, que serve via HTTPS da tailnet.

## Deploy

Este repo foi gerado do template [bernats-homelab/repotpl-k8s-app](https://github.com/bernats-homelab/repotpl-k8s-app). O cluster é gerenciado pelo [bernats-homelab/2026-kubernetes](https://github.com/bernats-homelab/2026-kubernetes), que fixa a versão em `kubernetes/apps/values.yaml`:

```yaml
apps:
  grocery-ops:
    repoURL: https://github.com/Bemesko/grocery-ops
    targetRevision: vX.Y.Z
```

Para uma versão nova:
1. Rode *Actions → release → Run workflow* na `main` com `vX.Y.Z`. O workflow publica `ghcr.io/bemesko/grocery-ops`, grava o digest em `deploy/base/kustomization.yaml` e cria a tag.
2. Abra um PR no repo central trocando o `targetRevision`. O resumo do job mostra o trecho pronto.

O CI ([ci.yaml](.github/workflows/ci.yaml)) roda o pre-commit e um e2e: constrói a imagem, sobe num k3s no runner e confere `/healthz`.

### O que o cluster espera

| | |
|---|---|
| Porta / health | `8080`, `GET /healthz` → `ok` |
| Usuário | não-root (`node`, uid 1000); raiz somente leitura, `/tmp` em `emptyDir` |
| Recursos | só namespaced (AppProject `homelab-apps`); o Postgres é um `Cluster` do CNPG em `deploy/base` (o operador precisa estar instalado no cluster) |
| Segredos | `deploy/**.sops.yaml` + KSOPS (veja [secret-generator.yaml](deploy/base/secret-generator.yaml)) |
| Repo e imagem | públicos: a credencial do ArgoCD só cobre a org `bernats-homelab` |
