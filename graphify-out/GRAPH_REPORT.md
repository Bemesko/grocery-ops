# Graph Report - graphify-001084  (2026-11-07)

## Corpus Check
- Corpus is ~3,787 words - fits in a single context window. You may not need a graph.

## Summary
- 113 nodes · 136 edges · 15 communities (6 shown, 9 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.88)
- Token cost: 146,757 input · 0 output

## Community Hubs (Navigation)
- Pre-commit and SOPS Checks
- CLI Tool Installer
- npm Package Manifest
- Release and Digest Pinning
- PWA Architecture and Guardrails
- Deployment Hardening and Probes
- KSOPS Offline Stub
- Template Init Script
- PWA Index Page
- App Icon
- Kustomize Build Script
- Actions Dependabot Updates

## God Nodes (most connected - your core abstractions)
1. `pre-commit hook configuration` - 8 edges
2. `Central repo bernats-homelab/2026-kubernetes` - 7 edges
3. `deploy/base kustomization` - 7 edges
4. `SOPS creation rules (deploy/**.sops.yaml)` - 6 edges
5. `Deployment grocery-ops` - 6 edges
6. `CI e2e job (k3s on runner)` - 5 edges
7. `Release workflow job` - 5 edges
8. `What the cluster expects (port 8080, /healthz, non-root, namespaced)` - 5 edges
9. `scripts` - 4 edges
10. `main()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `actionlint hook` --references--> `actionlint ubuntu-26.04 runner label`  [INFERRED]
  .pre-commit-config.yaml → .github/actionlint.yaml
- `Dependabot Docker base image updates` --conceptually_related_to--> `Images always by digest`  [INFERRED]
  .github/dependabot.yml → AGENTS.md
- `Dependabot npm nuxt group` --references--> `Nuxt 4 monolith (SPA + Nitro API)`  [INFERRED]
  .github/dependabot.yml → AGENTS.md
- `CI lint job (pre-commit)` --references--> `pre-commit hook configuration`  [EXTRACTED]
  .github/workflows/ci.yaml → .pre-commit-config.yaml
- `Release process (workflow + central repo PR)` --references--> `Release workflow job`  [EXTRACTED]
  README.md → .github/workflows/release.yaml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Release flow: build image, pin digest, tag, publish via central repo** — _github_workflows_release_release_job, _github_workflows_release_digest_commit_tag, scripts_set_image, deploy_base_kustomization_images_block, _github_workflows_release_central_repo_summary, agents_central_repo_2026_kubernetes [EXTRACTED 1.00]
- **Manifest hardening enforced by kube-linter via pre-commit and CI** — _kube_linter_checks, _pre_commit_config_validate_manifests, scripts_validate_manifests, _github_workflows_ci_lint_job, deploy_base_deployment_security_context, deploy_base_deployment_healthz_probes [INFERRED 0.85]
- **SOPS/age secret management shared with central repo** — _sops_creation_rules, _sops_wsl_age_key, _sops_cluster_age_key, _pre_commit_config_sops_encrypted, agents_sops_secrets_policy [INFERRED 0.85]

## Communities (15 total, 9 thin omitted)

### Community 0 - "Pre-commit and SOPS Checks"
Cohesion: 0.12
Nodes (16): actionlint hook, gitleaks hook, pre-commit hook configuration, sops-encrypted hook, validate-manifests hook (kubeconform + kube-linter), yamllint hook (strict), Cluster age recipient key (KSOPS), SOPS creation rules (deploy/**.sops.yaml) (+8 more)

### Community 1 - "CLI Tool Installer"
Cohesion: 0.14
Nodes (18): AGE_SHA256, AGE_VERSION, BIN_DIR, download(), install_bin(), install_tool(), KUBE_LINTER_SHA256, KUBE_LINTER_VERSION (+10 more)

### Community 2 - "npm Package Manifest"
Cohesion: 0.11
Nodes (17): dependencies, nuxt, vue, devDependencies, @vite-pwa/assets-generator, @vite-pwa/nuxt, name, private (+9 more)

### Community 3 - "Release and Digest Pinning"
Cohesion: 0.21
Nodes (13): Dependabot Docker base image updates, CI e2e job (k3s on runner), Release summary (central repo values snippet), Digest to kustomization, commit and tag, Release workflow job, Release version validation (vX.Y.Z), Central repo bernats-homelab/2026-kubernetes, deploy/base kustomization (+5 more)

### Community 4 - "PWA Architecture and Guardrails"
Cohesion: 0.17
Nodes (11): Dependabot npm nuxt group, CI lint job (pre-commit), Template placeholder check (app-template), no-kubeconfig hook, Nuxt 4 monolith (SPA + Nitro API), Service grocery-ops (80 -> http), Tailscale Ingress grocery-ops, Planned list sync via API + CNPG Postgres (+3 more)

### Community 5 - "Deployment Hardening and Probes"
Cohesion: 0.31
Nodes (6): kube-linter checks, Deployment grocery-ops, Readiness/liveness probes on /healthz, Hardened security context (non-root uid 1000, read-only root, drop ALL), /tmp emptyDir volume, What the cluster expects (port 8080, /healthz, non-root, namespaced)

## Knowledge Gaps
- **45 isolated node(s):** `{ $pwa }`, `name`, `private`, `type`, `dev` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 52 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pre-commit hook configuration` connect `Pre-commit and SOPS Checks` to `PWA Architecture and Guardrails`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `SOPS creation rules (deploy/**.sops.yaml)` (e.g. with `sops-encrypted hook` and `Secrets only in encrypted deploy/**.sops.yaml`) actually correct?**
  _`SOPS creation rules (deploy/**.sops.yaml)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ $pwa }`, `name`, `private` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Pre-commit and SOPS Checks` be split into smaller, more focused modules?**
  _Cohesion score 0.11695906432748537 - nodes in this community are weakly interconnected._
- **Why does `Central repo bernats-homelab/2026-kubernetes` connect `Release and Digest Pinning` to `Pre-commit and SOPS Checks`, `Deployment Hardening and Probes`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `CLI Tool Installer` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._
- **Why does `SOPS creation rules (deploy/**.sops.yaml)` connect `Pre-commit and SOPS Checks` to `Release and Digest Pinning`, `Deployment Hardening and Probes`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
