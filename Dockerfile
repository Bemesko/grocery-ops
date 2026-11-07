# Monolito Nuxt 4: SPA + API (Nitro) num processo Node, não-root, na porta 8080 com /healthz.
# Imagem base sempre por digest (a mesma do Makefile).
FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build
WORKDIR /app
COPY package.json package-lock.json ./
# `nuxt build` já roda o prepare; sem scripts de install o npm ci não depende do código.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# SDK do OpenTelemetry, fora do bundle do Nitro (otel/instrumentation.mjs).
FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS otel
WORKDIR /otel
COPY otel/package.json otel/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY otel/instrumentation.mjs ./

FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
ARG VERSION=dev
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    NUXT_APP_VERSION=${VERSION}
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=otel /otel ./otel
USER node
EXPOSE 8080
# Telemetria só liga com OTEL_EXPORTER_OTLP_ENDPOINT (veja otel/instrumentation.mjs).
# DEP0205: o Node 26 depreciou module.register(), que o import-in-the-middle ainda usa
# para o hook de ESM; sem o filtro, o aviso sai em texto no meio dos logs JSON.
CMD ["node", "--disable-warning=DEP0205", "--import", "./otel/instrumentation.mjs", ".output/server/index.mjs"]
