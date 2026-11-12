# Contexto

PWA de lista de compras e acompanhamento do carrinho (`grocery-ops`), publicado no k3s do homelab pelo repo central `bernats-homelab/2026-kubernetes`. O central só declara a Application (`apps.grocery-ops` em `kubernetes/apps/values.yaml`), fixada numa tag `vX.Y.Z` deste repo. Este repo foi gerado do template `bernats-homelab/repotpl-k8s-app`. A especificação do produto está em `docs/produto-v1.md`.

# Stack

- Nuxt 4 como monolito: SPA (`ssr: false`) + API Nitro (`server/api`) num processo Node; PWA via `@vite-pwa/nuxt`
- Imagem `node:26-alpine` por digest, a mesma no `Dockerfile` e no `Makefile` (npm roda via Docker, sem Node local)
- Postgres qualquer via `DATABASE_URL` (driver `postgres`, migrações em `server/db/migracoes.ts`). O app não depende de operador nem de provedor de banco
- OpenTelemetry: traces e métricas por OTLP, ligados só com `OTEL_EXPORTER_OTLP_ENDPOINT`. O SDK fica em `otel/` (pacote próprio, carregado com `node --import`); o app só usa `@opentelemetry/api` (`server/utils/telemetria.ts`). Logs vão em JSON para o stdout, com `trace_id`, e não por OTLP: o coletor do cluster já lê os logs dos pods

# Estrutura

- `app/`: front Vue (`app.vue`, `pages/`, `components/`); `shared/`: código usado no front e na API
- `server/routes/healthz.get.ts`: probes e e2e; não mude a rota nem a porta 8080 sem ajustar `deploy/` e o CI
- `deploy/base`: só o app, sem Ingress, banco ou destino de telemetria. Contratos: Secret `grocery-ops-db` (chave `DATABASE_URL`), ConfigMap opcional `grocery-ops-otel` (variáveis `OTEL_*`) e Secret opcional `grocery-ops-alexa` (`HA_URL`, `HA_TOKEN`, `HA_TODO_ENTITY`: lista da Alexa via Home Assistant; o entity_id tem um e-mail, só no sops). A base sozinha precisa ficar Healthy (o e2e do repo central a sincroniza sem Tailscale): por isso o secret é opcional nela
- `deploy/components/postgres-cnpg`: Postgres pelo CloudNativePG, opcional; troque o componente para usar outro Postgres
- `deploy/overlays/tailscale` (notebook, host `grocery-ops`): base + Ingress + CNPG + telemetria para o `otel-agent` do cluster
- `deploy/overlays/ci` (só o e2e): base + Postgres simples + OTel Collector com exporter `debug`
- `.github/workflows/release.yaml`: único jeito de gerar versão (imagem → digest na kustomization → tag)

# Restrições

- Imagens sempre por digest; a da app em `images:` só o `release.yaml` altera (`scripts/set-image.sh`)
- Repo e pacote GHCR públicos (o ArgoCD não tem credencial para a conta pessoal)
- Nunca versionar o nome da tailnet (`*.ts.net`), hostname, usuário ou kubeconfig
- Segredos só em `deploy/**.sops.yaml` criptografados no caminho final (WSL + cluster). Nunca usar a chave de teste do CI do central
- Só recursos namespaced (AppProject `homelab-apps`): nada de ClusterRole, CRD ou webhook
- Manifests passam no `.kube-linter.yaml`: probes, requests, `runAsNonRoot`, `readOnlyRootFilesystem`, `drop: [ALL]`
- Dados pessoais (compras, CSV de histórico) nunca no repo: o repo é público
- `@opentelemetry/api` com a mesma versão na raiz e em `otel/` (o app acha o SDK pelo registro global da API)

# Testes

- `make test` (WSL): pre-commit completo, incluindo kubeconform + kube-linter de `deploy/` (componentes entram pelos overlays)
- `make run`: imagem de produção com raiz read-only, como no cluster, com o Postgres do `make db`
- CI `e2e`: k3s no runner, imagem do próprio job, `deploy/overlays/ci` Available + `/healthz` + API com o banco + traces e métricas chegando ao coletor
