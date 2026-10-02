#!/usr/bin/env bash
# Instalação do zero: cria o .env (com senhas geradas), sobe tudo, aplica migrations,
# cria credenciais, importa e publica os workflows.
# Uso: bash scripts/setup.sh
source "$(dirname "$0")/lib.sh"

command -v docker >/dev/null || fail "Docker não encontrado. Instale: https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 não encontrado."
command -v node >/dev/null || fail "Node.js 22+ não encontrado (necessário para os scripts)."

if [ ! -f "$ENV_FILE" ]; then
  log "criando .env a partir do .env.example (com senhas aleatórias)"
  cp "$ROOT/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  rand() { node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"; }
  PGPASS="$(rand 18)"
  sed -i.bak \
    -e "s|^N8N_ENCRYPTION_KEY=.*|N8N_ENCRYPTION_KEY=$(rand 32)|" \
    -e "s|^N8N_WEBHOOK_TOKEN=.*|N8N_WEBHOOK_TOKEN=$(rand 24)|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PGPASS|" \
    -e "s|TROQUE_A_SENHA|$PGPASS|" "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
  log ".env criado. Preencha OPENAI_API_KEY, META_* e SUPABASE_* quando tiver (o sistema funciona em DRY RUN sem elas)."
fi
load_env

build_images
log "subindo serviços"
dc up -d postgres
wait_healthy postgres
dc up -d engine renderer
dc up migrate
dc up -d n8n
wait_healthy engine
wait_healthy renderer
wait_healthy n8n 80
import_n8n

cat <<MSG

Tudo no ar (modo SIMULAÇÃO: ENABLE_REAL_INSTAGRAM_PUBLISH=${ENABLE_REAL_INSTAGRAM_PUBLISH:-false}).
  n8n:       http://localhost:${N8N_PORT:-5678}  (crie o usuário dono no primeiro acesso)
  renderer:  http://localhost:${RENDERER_PORT:-3000}/health

Teste manual (dry run):
  curl -s -X POST http://localhost:${N8N_PORT:-5678}/webhook/loteria-cursos/run \\
    -H "X-LC-Token: \$N8N_WEBHOOK_TOKEN" -H "Content-Type: application/json" \\
    -d '{"game":"megasena","action":"result","dry_run":true}'
MSG
