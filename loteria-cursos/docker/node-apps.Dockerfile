# syntax=docker/dockerfile:1
# Imagens dos serviços Node do projeto (engine, renderer, mock-server, migrate).
# Um único Dockerfile com vários "targets" — cada serviço usa o seu.
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- dependências (com e sem dev) ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/lottery-core/package.json packages/lottery-core/
COPY apps/engine/package.json apps/engine/
COPY apps/renderer/package.json apps/renderer/
COPY apps/mock-server/package.json apps/mock-server/
COPY database/package.json database/
# EXTRA_CA (opcional): certificado de proxy corporativo para o npm. Nunca desliga a verificação TLS.
RUN --mount=type=secret,id=extra_ca,required=false --mount=type=cache,target=/root/.npm \
    sh -c 'if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; npm ci --no-audit --no-fund'

FROM deps AS prod-deps
RUN --mount=type=secret,id=extra_ca,required=false --mount=type=cache,target=/root/.npm \
    sh -c 'if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; npm prune --omit=dev --no-audit --no-fund'

# ---------- build ----------
FROM deps AS build
COPY tsconfig.json ./
COPY packages packages
COPY apps apps
COPY scripts/build-apps.mjs scripts/build-apps.mjs
RUN node scripts/build-apps.mjs

# ---------- base de execução ----------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production TZ=America/Bahia
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
USER node

FROM runtime AS engine
COPY --from=build --chown=node:node /app/dist/engine.mjs /app/dist/engine.mjs.map ./dist/
ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist/engine.mjs"]

FROM runtime AS renderer
COPY --from=build --chown=node:node /app/dist/renderer.mjs /app/dist/renderer.mjs.map ./dist/
COPY --chown=node:node apps/renderer/config ./config
COPY --chown=node:node apps/renderer/assets ./assets
USER root
RUN mkdir -p /data/renders && chown -R node:node /data/renders
USER node
ENV PORT=3000 RENDER_OUTPUT_DIR=/data/renders BRAND_CONFIG_PATH=/app/config/brand.json
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist/renderer.mjs"]

FROM runtime AS mock-server
COPY --from=build --chown=node:node /app/dist/mock-server.mjs /app/dist/mock-server.mjs.map ./dist/
ENV PORT=4010 FIXTURES_DIR=/fixtures
EXPOSE 4010
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/mock-server.mjs"]

FROM runtime AS migrate
COPY --chown=node:node database ./database
CMD ["node", "database/migrate.mjs"]
