#!/usr/bin/env bash
# Funções compartilhadas pelos scripts. Uso: source scripts/lib.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-loteria-cursos}"
COMPOSE_FILES="${COMPOSE_FILES:--f $ROOT/docker-compose.yml}"

log() { printf '\033[1;34m[loteria-cursos]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }

load_env() {
  [ -f "$ENV_FILE" ] || fail "arquivo $ENV_FILE não encontrado (rode scripts/setup.sh)"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

dc() {
  # shellcheck disable=SC2086
  docker compose -p "$COMPOSE_PROJECT" --env-file "$ENV_FILE" $COMPOSE_FILES "$@"
}

wait_healthy() {
  local service="$1" tries="${2:-60}"
  for _ in $(seq 1 "$tries"); do
    local id status
    id="$(dc ps -q "$service" 2>/dev/null || true)"
    if [ -n "$id" ]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
      [ "$status" = "healthy" ] && return 0
    fi
    sleep 3
  done
  dc logs --tail 50 "$service" || true
  fail "serviço $service não ficou saudável"
}

# Constrói as imagens. EXTRA_CA_CERT_FILE (opcional) = certificado de proxy corporativo para o npm.
build_images() {
  local secret_args=()
  if [ -n "${EXTRA_CA_CERT_FILE:-}" ] && [ -s "$EXTRA_CA_CERT_FILE" ]; then
    secret_args=(--secret "id=extra_ca,src=$EXTRA_CA_CERT_FILE")
  fi
  local node_image="${NODE_IMAGE:-node:22-bookworm-slim}"
  for target in migrate engine renderer mock-server; do
    log "construindo imagem $target"
    DOCKER_BUILDKIT=1 docker build "${secret_args[@]}" --build-arg "NODE_IMAGE=$node_image" \
      -f "$ROOT/docker/node-apps.Dockerfile" --target "$target" -t "loteria-cursos/$target:local" "$ROOT" >/dev/null
  done
}

WORKFLOW_IDS=(LcWf99ErrorHdl00 LcWf04Publish000 LcWf03Render0000 LcWf05Check00000 LcWf02Predict000 LcWf01SyncRes000 LcWf06Insights00 LcWf00Health0000 LcWf07Orchestr00)

import_n8n() {
  log "criando/atualizando credenciais do n8n a partir do .env (sem gravar segredo em disco)"
  node "$ROOT/scripts/create-n8n-credentials.mjs" | dc exec -T n8n sh -c 'umask 077; cat > /tmp/lc-creds.json && n8n import:credentials --input=/tmp/lc-creds.json; rc=$?; rm -f /tmp/lc-creds.json; exit $rc'
  log "importando workflows"
  dc exec -T n8n n8n import:workflow --separate --input=/import/workflows
  log "publicando workflows (sub-workflows precisam estar publicados no n8n 2.x)"
  for id in "${WORKFLOW_IDS[@]}"; do
    dc exec -T n8n n8n publish:workflow --id="$id" >/dev/null
  done
  log "reiniciando n8n para carregar as publicações"
  dc restart n8n >/dev/null
  wait_healthy n8n 60
  wait_webhooks
}

# O /healthz do n8n responde antes de os webhooks dos workflows publicados estarem registrados.
# Sem token, um webhook registrado responde 403 (sem executar nada); ainda não registrado = 404.
wait_webhooks() {
  local url="http://127.0.0.1:${N8N_PORT:-5678}/webhook/loteria-cursos/run" code=""
  for _ in $(seq 1 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$url" || true)"
    [ "$code" = "403" ] && { log "webhooks registrados"; return 0; }
    sleep 2
  done
  fail "webhook do WF-07 não ficou disponível (último status: $code)"
}
