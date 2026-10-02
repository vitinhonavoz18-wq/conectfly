#!/usr/bin/env bash
# Testes de integração: PostgreSQL REAL (container descartável) + engine/renderer/simuladores
# conversando por HTTP de verdade. Não usa n8n (isso é o E2E) e não toca APIs reais.
# Uso: bash scripts/test-integration.sh      (ou TEST_DATABASE_URL=... para usar um banco seu)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER=""
cleanup() { [ -n "$CONTAINER" ] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ -z "${TEST_DATABASE_URL:-}" ]; then
  command -v docker >/dev/null || { echo "Docker necessário (ou defina TEST_DATABASE_URL)"; exit 1; }
  PORT="${TEST_DB_PORT:-55499}"
  CONTAINER="lc-int-pg-$$"
  docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD=int-test-only -e POSTGRES_DB=loteria_test \
    -p "127.0.0.1:$PORT:5432" "${POSTGRES_IMAGE:-postgres:17-alpine}" >/dev/null
  for _ in $(seq 1 60); do docker exec "$CONTAINER" pg_isready -U postgres -d loteria_test >/dev/null 2>&1 && break; sleep 1; done
  sleep 2
  export TEST_DATABASE_URL="postgres://postgres:int-test-only@127.0.0.1:$PORT/loteria_test"
fi
cd "$ROOT"
npx vitest run --project integration "$@"
