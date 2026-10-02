#!/usr/bin/env bash
# Valida, importa e publica os workflows + cria as credenciais no n8n que está rodando.
# Uso: bash scripts/import-workflows.sh
source "$(dirname "$0")/lib.sh"
load_env
node "$ROOT/scripts/validate-workflows.mjs"
import_n8n
log "pronto. Abra http://localhost:${N8N_PORT:-5678}"
