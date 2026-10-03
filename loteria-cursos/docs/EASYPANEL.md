# Loteria Cursos no EasyPanel

## Workflows já criados no seu n8n (conectfly-n8n.lnuwza.easypanel.host)

Criados em 02/10/2026, **todos desligados** (não publicados), no projeto pessoal, com nomes começando por
`Loteria Cursos —`:

| Workflow                       | ID no seu n8n      | ID fixo do repositório |
| ------------------------------ | ------------------ | ---------------------- |
| WF-00-System-Health            | `xv7Wuu1oFgUG5lc6` | `LcWf00Health0000`     |
| WF-01-Sync-Lottery-Results     | `tBA3suGT0AeZoiJB` | `LcWf01SyncRes000`     |
| WF-02-Generate-Predictions     | `CKVC5tSR5zOy1PqS` | `LcWf02Predict000`     |
| WF-03-Render-Social-Post       | `vtpl045anq1vXiyq` | `LcWf03Render0000`     |
| WF-04-Publish-Instagram        | `62c8YpiJ6wxQOScy` | `LcWf04Publish000`     |
| WF-05-Check-Prediction-Results | `6o86isqUS0m6pqUt` | `LcWf05Check00000`     |
| WF-06-Instagram-Analytics      | `yqy6fDeFTHz3pPcE` | `LcWf06Insights00`     |
| WF-07-Content-Orchestrator     | `AOyVZSNrHeztpNms` | `LcWf07Orchestr00`     |
| WF-99-Global-Error-Handler     | `XaYt1xuFNq5p0ctb` | `LcWf99ErrorHdl00`     |

As chamadas entre eles (Execute Sub-workflow) já apontam para os IDs novos. Fuso: America/Bahia.
Foram criados pelo MCP do n8n a partir dos JSON (`node scripts/to-n8n-sdk.mjs <arquivo> <mapa-de-ids>`).

## O que ainda falta para funcionar

### 1. Serviços no EasyPanel (o n8n sozinho não basta)

Os workflows chamam três peças que precisam estar rodando no mesmo projeto do EasyPanel:

| Serviço      | Como criar no EasyPanel                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres     | _+ Service → Postgres_ (versão 17). Banco só da Loteria — **não** use o banco de outro sistema.                                                                      |
| engine       | _+ Service → App_, fonte GitHub `conectfly`, Dockerfile `loteria-cursos/docker/node-apps.Dockerfile`, build target `engine`, contexto `loteria-cursos`, porta 3001   |
| renderer     | igual ao engine, target `renderer`, porta 3000, variáveis `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`          |
| migrate (1×) | igual, target `migrate`, com `DATABASE_URL` do Postgres acima e `ENGINE_URL`/`RENDERER_URL` com os nomes internos do EasyPanel (ex.: `http://<projeto>_engine:3001`) |

O `migrate` cria as tabelas e grava em `system_settings` os endereços do engine e do renderer — é daí que os
workflows leem para onde ligar.

### 2. Credenciais no n8n

Crie em _Credentials → Add credential_:

| Nome                      | Tipo        | Conteúdo                                              |
| ------------------------- | ----------- | ----------------------------------------------------- |
| Postgres — Loteria Cursos | Postgres    | dados do Postgres do passo 1                          |
| Webhook — Loteria Cursos  | Header Auth | Name `X-LC-Token`, Value: uma senha longa nova        |
| Meta — Loteria Cursos     | Header Auth | Name `Authorization`, Value `Bearer <token da Meta>`  |
| OpenAI — Loteria Cursos   | OpenAI      | chave da OpenAI (pode reaproveitar a que você já tem) |

**Atenção:** ao criar os workflows, o n8n ligou sozinho os nós de banco à credencial existente
`Postgres account` e os webhooks à `Header Auth account` — que são de outros sistemas. Elas precisam ser
trocadas pelas credenciais acima antes de ligar qualquer workflow (dá para trocar todos de uma vez pelo MCP).

### 3. Ligar

Só depois dos passos 1 e 2: publicar primeiro WF-99, depois WF-00…WF-06 e por último WF-07; e então
definir WF-99 como _Error Workflow_ dos outros (o n8n só aceita isso com o WF-99 publicado).
`enable_real_instagram_publish` continua `false` — tudo roda em simulação até você virar a chave.
