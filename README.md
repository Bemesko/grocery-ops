# grocery-ops

PWA de lista de compras e acompanhamento do carrinho no mercado. Roda no cluster k3s do homelab, em `https://grocery-ops.<sua-tailnet>`, e pode ser instalado no celular.

**Estado:** v1 conforme [docs/produto-v1.md](docs/produto-v1.md): lista compartilhada, preparar a ida, modo mercado com budget do VR, resumo da compra, gastos do mês e importação de histórico por CSV.

## Stack

- **Nuxt 4 como monolito:** SPA (`ssr: false`) e API (Nitro, `server/api`) no mesmo processo Node e na mesma imagem.
- **PWA** com [`@vite-pwa/nuxt`](https://vite-pwa-org.netlify.app/frameworks/nuxt):
  - manifest e service worker com precache da casca (abre sem sinal no mercado);
  - ícones gerados no build a partir de [`public/icon.svg`](public/icon.svg).
- **Postgres** qualquer, via `DATABASE_URL`; o schema é migrado pelo app na subida ([server/db/migracoes.ts](server/db/migracoes.ts)). No cluster ele vem do CloudNativePG, por um componente opcional do kustomize.
- **OpenTelemetry**: traces (HTTP da API e cada consulta ao Postgres) e métricas (HTTP, runtime do Node e de negócio: compras, valor, itens do carrinho) por OTLP. O SDK fica em [otel/](otel/instrumentation.mjs) e só liga com `OTEL_EXPORTER_OTLP_ENDPOINT`. Logs saem em JSON no stdout com `trace_id`.

```
app/            front (Vue): app.vue, pages/
server/routes/  /healthz (probes do Kubernetes e e2e)
server/api/     API (lista, itens, compras, saldo, gastos, importação)
server/db/      migrações do Postgres
shared/         código usado no front e na API (texto, busca, budget, tipos)
docs/           especificação da v1 e modelo de CSV
public/         estáticos (icon.svg → ícones do PWA)
otel/           SDK do OpenTelemetry (pacote próprio, carregado com node --import)
deploy/         kustomize: base (só o app), components/postgres-cnpg, overlays/tailscale (notebook) e overlays/ci (e2e)
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

O CI ([ci.yaml](.github/workflows/ci.yaml)) roda o pre-commit e um e2e: constrói a imagem, sobe `deploy/overlays/ci` num k3s no runner (com um Postgres simples e um OTel Collector) e confere `/healthz`, a API com o banco e a chegada de traces e métricas ao coletor.

### O que o cluster espera

| | |
|---|---|
| Porta / health | `8080`, `GET /healthz` → `ok` |
| Usuário | não-root (`node`, uid 1000); raiz somente leitura, `/tmp` em `emptyDir` |
| Recursos | só namespaced (AppProject `homelab-apps`) |
| Banco | contrato da base: Secret `grocery-ops-db` com `DATABASE_URL`. O overlay `tailscale` usa o componente [postgres-cnpg](deploy/components/postgres-cnpg/kustomization.yaml) (precisa do operador CNPG no cluster); para outro Postgres, troque o componente |
| Telemetria | ConfigMap opcional `grocery-ops-otel` com variáveis `OTEL_*`. O overlay `tailscale` aponta para o `otel-agent.observability.svc:4318` (ADR 008 do repo central) |
| Segredos | `deploy/**.sops.yaml` + KSOPS (veja [secret-generator.yaml](deploy/base/secret-generator.yaml)) |
| Repo e imagem | públicos: a credencial do ArgoCD só cobre a org `bernats-homelab` |
