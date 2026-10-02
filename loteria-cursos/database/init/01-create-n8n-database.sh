#!/bin/sh
# Roda só na PRIMEIRA criação do volume do Postgres.
# Cria um banco separado para os dados internos do n8n (workflows, execuções, credenciais criptografadas).
# Os dados da Loteria Cursos ficam no banco POSTGRES_DB.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
SELECT 'CREATE DATABASE "${N8N_DB_NAME:-n8n}"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${N8N_DB_NAME:-n8n}')\gexec
EOSQL
