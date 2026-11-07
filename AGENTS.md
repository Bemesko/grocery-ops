# Contexto

PWA de lista de compras e acompanhamento do carrinho (`grocery-ops`), publicado no k3s do homelab pelo repo central `bernats-homelab/2026-kubernetes`. O central só declara a Application (`apps.grocery-ops` em `kubernetes/apps/values.yaml`), fixada numa tag `vX.Y.Z` deste repo. Este repo foi gerado do template `bernats-homelab/repotpl-k8s-app`.

# Stack

- Nuxt 4 como monolito: SPA (`ssr: false`) + API Nitro (`server/api`) num processo Node; PWA via `@vite-pwa/nuxt`
- Imagem `node:26-alpine` por digest, a mesma no `Dockerfile` e no `Makefile` (npm roda via Docker, sem Node local)
- Sincronização entre celulares (futuro): rotas em `server/api` + Postgres como `Cluster` do CNPG em `deploy/`

# Estrutura

- `app/`: front Vue (`app.vue`, `pages/`)
- `server/routes/healthz.get.ts`: probes e e2e; não mude a rota nem a porta 8080 sem ajustar `deploy/` e o CI
- `deploy/base` (CI, sem Ingress) e `deploy/overlays/tailscale` (notebook, host `grocery-ops`)
- `.github/workflows/release.yaml`: único jeito de gerar versão (imagem → digest na kustomization → tag)

# Restrições

- Imagens sempre por digest; a da app em `images:` só o `release.yaml` altera (`scripts/set-image.sh`)
- Repo e pacote GHCR públicos (o ArgoCD não tem credencial para a conta pessoal)
- Nunca versionar o nome da tailnet (`*.ts.net`), hostname, usuário ou kubeconfig
- Segredos só em `deploy/**.sops.yaml` criptografados no caminho final (WSL + cluster). Nunca usar a chave de teste do CI do central
- Só recursos namespaced (AppProject `homelab-apps`): nada de ClusterRole, CRD ou webhook
- Manifests passam no `.kube-linter.yaml`: probes, requests, `runAsNonRoot`, `readOnlyRootFilesystem`, `drop: [ALL]`

# Testes

- `make test` (WSL): pre-commit completo, incluindo kubeconform + kube-linter de `deploy/`
- `make run`: imagem de produção com raiz read-only, como no cluster
- CI `e2e`: k3s no runner, imagem do próprio job, `deploy/base` Available + `/healthz`
