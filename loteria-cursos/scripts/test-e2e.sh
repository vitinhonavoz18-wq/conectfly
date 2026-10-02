#!/usr/bin/env bash
# E2E local: sobe a stack completa com simuladores (CAIXA, OpenAI, Meta, Storage),
# importa/publica os workflows no n8n REAL e roda os cenários de ponta a ponta.
# Nada toca APIs reais. Uso: bash scripts/test-e2e.sh [--keep]  (--keep não derruba a stack no fim)
export ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/tests/e2e/e2e.env"
export COMPOSE_PROJECT=loteria-cursos-e2e
export COMPOSE_FILES="-f $(cd "$(dirname "$0")/.." && pwd)/docker-compose.yml --profile mock"
source "$(dirname "$0")/lib.sh"
load_env

KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

node "$ROOT/scripts/validate-workflows.mjs"
if [ "${SKIP_BUILD:-0}" != "1" ]; then build_images; fi
log "subindo stack E2E (projeto $COMPOSE_PROJECT)"
dc down -v --remove-orphans >/dev/null 2>&1 || true
dc up -d postgres mock-server
wait_healthy postgres
wait_healthy mock-server
dc up -d engine renderer
dc up migrate
dc up -d n8n
wait_healthy engine
wait_healthy renderer
wait_healthy n8n 80
import_n8n

log "rodando cenários E2E"
set +e
E2E_DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:$POSTGRES_PORT/$POSTGRES_DB" \
E2E_N8N_URL="http://127.0.0.1:$N8N_PORT" E2E_MOCK_URL="http://127.0.0.1:$MOCK_PORT" E2E_WEBHOOK_TOKEN="$N8N_WEBHOOK_TOKEN" \
  npx vitest run --project e2e
rc=$?
set -e
if [ $rc -ne 0 ]; then
  log "falhou — últimos logs do n8n:"
  dc logs --tail 80 n8n || true
fi
[ $KEEP -eq 1 ] || dc down -v --remove-orphans >/dev/null
exit $rc
