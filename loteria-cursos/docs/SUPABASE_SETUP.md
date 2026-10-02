# Supabase — configuração

> **NÃO TESTADO CONTRA API REAL** (sem projeto/chave). O upload foi testado contra o simulador, que segue a
> API REST do Supabase Storage (`POST /storage/v1/object/{bucket}/{caminho}`, `GET /storage/v1/bucket/{id}`,
> URL pública `/storage/v1/object/public/{bucket}/{caminho}`).

## Storage (obrigatório para publicar de verdade)

A Meta **baixa** a imagem pela URL informada — ela precisa ser pública. `localhost` não serve.

1. Crie um projeto em <https://supabase.com/dashboard>.
2. _Storage → New bucket_: nome **`social-media`**, marque **Public bucket**.
   (O health check avisa se o bucket não for público.)
3. Copie a URL do projeto (`https://<id>.supabase.co`) e a chave secreta do servidor
   (_Settings → API Keys_: **secret key** `sb_secret_…`; a antiga _service_role_ também funciona).
4. `.env`:
   ```env
   STORAGE_DRIVER=supabase
   SUPABASE_URL=https://<id>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   SUPABASE_STORAGE_BUCKET=social-media
   ```
5. `docker compose up -d renderer` e confira: `curl -s localhost:3000/health/storage` → `{"status":"ok"}`.

Estrutura dos arquivos (nomes determinísticos, JPEG):

```
social-media/
  megasena/results/megasena-result-3065-feed.jpg
  megasena/predictions/megasena-prediction-3066-feed.jpg
  megasena/checks/megasena-check-3066-feed.jpg
  lotofacil/… quina/… lotomania/…
```

Simulações (dry-run) usam o sufixo `-dryrun` para nunca sobrescrever a arte de um post real.

**Por que `.jpg` e não `.png`:** a Instagram API aceita **somente JPEG** para imagens.

**Segurança da chave:** `SUPABASE_SERVICE_ROLE_KEY` só existe no container `renderer` (servidor). Nunca
coloque essa chave em site, app ou qualquer frontend — ela ignora as regras de acesso (RLS) do banco.
Chaves novas (`sb_secret_…`) vão no header `apikey`; chaves antigas em formato JWT vão também em
`Authorization: Bearer` — o renderer faz isso sozinho.

## Banco de dados (opcional: usar o Postgres do Supabase)

Por padrão o banco roda no Docker (PostgreSQL 17). Para usar o Postgres do Supabase como banco da aplicação:

1. _Project Settings → Database → Connection string_ (use a conexão direta ou o _session pooler_, porta 5432).
2. No `.env`, defina `MIGRATE_DATABASE_URL='postgres://…?sslmode=require'` — o serviço `migrate` passa a
   aplicar migrations, seeds e configurações no Supabase a cada `docker compose up`.
3. Ajuste a credencial do n8n: no `.env`, `APP_DB_HOST=<host>`, `APP_DB_PORT=5432`, `APP_DB_SSL=require`,
   `APP_DB_NAME=postgres`, `APP_DB_USER=…`, `APP_DB_PASSWORD=…` (dados do Supabase) — e rode
   `bash scripts/import-workflows.sh`. As variáveis `POSTGRES_*` continuam sendo do Postgres do Docker.
4. O banco interno do n8n pode continuar no Postgres do Docker.

**Proteção da API REST automática do Supabase:** a migration `0005_row_level_security.sql` liga o RLS em
todas as tabelas **sem nenhuma política** — a API pública (`anon`/`authenticated`) não lê nem grava nada.
Só o dono das tabelas (o usuário que o n8n usa) acessa. Não crie políticas de leitura pública.
