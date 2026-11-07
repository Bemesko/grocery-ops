# Rode no WSL. O CI chama os mesmos scripts.
# Node não precisa estar instalado: npm roda na mesma imagem (por digest) do Dockerfile.
SHELL := /usr/bin/env bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

export PATH := $(HOME)/.local/bin:$(PATH)

NODE_IMAGE := node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
NODE_RUN := docker run --rm -v $(CURDIR):/app -w /app -e npm_config_cache=/tmp/.npm -e npm_config_update_notifier=false

# Postgres local (mesma major do CNPG em deploy/base/database.yaml), dados em .data/postgres.
POSTGRES_IMAGE := postgres:18.1-alpine@sha256:aa6eb304ddb6dd26df23d05db4e5cb05af8951cda3e0dc57731b771e0ef4ab29
DB_CONTAINER := grocery-ops-db
DB_URL := postgres://app:app@host.docker.internal:5432/app
DB_ENV := --add-host=host.docker.internal:host-gateway -e DATABASE_URL=$(DB_URL)

.PHONY: help deps lint validate test install dev build run db db-stop

help: ## Lista os targets
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

deps: ## Instala as ferramentas (versões e sha256 fixados) em ~/.local/bin
	./scripts/setup-tools.sh

lint: ## Todos os hooks do pre-commit em todos os arquivos
	pre-commit run --all-files

validate: ## kubeconform + kube-linter em deploy/ (base e overlays)
	./scripts/validate-manifests.sh

test: lint ## Tudo que roda sem cluster (o lint já inclui o validate)

install: ## npm ci no container Node fixado
	$(NODE_RUN) $(NODE_IMAGE) npm ci

db: ## Sobe o Postgres local em background (porta 5432)
	@docker start $(DB_CONTAINER) >/dev/null 2>&1 || docker run -d --name $(DB_CONTAINER) -p 5432:5432 \
		-e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app \
		-v $(CURDIR)/.data/postgres:/var/lib/postgresql $(POSTGRES_IMAGE) >/dev/null
	@echo "Postgres em localhost:5432 (app/app)"

db-stop: ## Para o Postgres local (os dados ficam em .data/postgres)
	docker stop $(DB_CONTAINER)

dev: db ## Nuxt em modo dev em http://localhost:3000 (rode `make install` antes)
	$(NODE_RUN) -it -p 3000:3000 $(DB_ENV) $(NODE_IMAGE) npx nuxt dev --host 0.0.0.0

build: ## Build da imagem de produção (a mesma do release)
	docker build -t grocery-ops:local .

run: build db ## Sobe a imagem de produção em http://localhost:8080
	docker run --rm -it -p 8080:8080 --read-only --tmpfs /tmp $(DB_ENV) grocery-ops:local
