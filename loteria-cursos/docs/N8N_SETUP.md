# n8n — configuração

Versão alvo: **n8n 2.41.5** (canal _stable_ em 02/10/2026). Os workflows foram **importados, publicados e
executados** nessa versão nos testes E2E (`npm run test:e2e`).

## O que mudou no n8n 2.x e foi levado em conta

Fonte: `docs/changelog/v20-breaking-changes.md` do repositório oficial `n8n-io/n8n-docs` e o código da imagem 2.41.5.

- **Publicar substitui ativar.** O botão "Active" virou _Publish_. Pela CLI: `n8n publish:workflow --id=…`
  (o antigo `update:workflow --active` está obsoleto). Após publicar pela CLI é preciso **reiniciar** o n8n.
- **Sub-workflows precisam estar publicados.** Em execução de produção o n8n carrega a versão publicada do
  sub-workflow; se não houver, dá _"Workflow is not active and cannot be executed"_. Por isso os 9 são publicados.
- **Variáveis de ambiente bloqueadas nos nodes** (`N8N_BLOCK_ENV_ACCESS_IN_NODE=true` por padrão).
  Mantivemos o bloqueio: configuração vem da tabela `system_settings`, segredos das Credentials.
- **Task runners ligados por padrão** (Code node isolado). Os Code nodes daqui são pequenos e sem `require`.
- **Postgres 16 é só "compatibilidade"** (o próprio n8n 2.41 avisa); usamos **PostgreSQL 17**.
- **Escuta IPv6 (`::`)** por padrão; em hosts sem IPv6 o n8n não sobe — `N8N_LISTEN_ADDRESS=0.0.0.0` no compose.
- **Tags na importação:** `n8n import:workflow` cria a mesma tag em paralelo e viola um índice único
  (visto no 2.41.5). Os JSON vêm sem tags.

## Variáveis importantes (docker-compose)

| Variável                                 | Valor                           | Por quê                                                                                 |
| ---------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `DB_TYPE=postgresdb` + `DB_POSTGRESDB_*` | banco `n8n` no mesmo Postgres   | sem SQLite, nem em desenvolvimento                                                      |
| `N8N_ENCRYPTION_KEY`                     | gerada pelo setup               | criptografa as credenciais. **Guarde-a**: sem ela as credenciais salvas ficam ilegíveis |
| `GENERIC_TIMEZONE` / `TZ`                | `America/Bahia`                 | horário dos Schedule Triggers e dos logs                                                |
| `WEBHOOK_URL`                            | URL pública do n8n              | endereço dos webhooks (produção: `https://seu-dominio/`)                                |
| `N8N_SECURE_COOKIE`                      | `false` local, `true` com HTTPS |                                                                                         |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE`           | `true`                          | workflows não leem env                                                                  |
| `EXECUTIONS_DATA_PRUNE` / `MAX_AGE`      | `true` / 336h                   | histórico de 14 dias                                                                    |
| `N8N_DIAGNOSTICS_ENABLED`                | `false`                         | sem telemetria                                                                          |

## Credenciais (criadas automaticamente a partir do `.env`)

`bash scripts/import-workflows.sh` gera as 4 credenciais com **IDs fixos** — os workflows já apontam para elas.
Os segredos passam pela entrada padrão direto para `n8n import:credentials` (que criptografa com a chave da
instância) e o arquivo temporário dentro do container é apagado na hora.

| Nome                      | Tipo n8n    | Conteúdo                                             | Usada em                  |
| ------------------------- | ----------- | ---------------------------------------------------- | ------------------------- |
| Postgres — Loteria Cursos | Postgres    | host/porta/banco/usuário/senha do banco da aplicação | todos                     |
| OpenAI — Loteria Cursos   | OpenAI API  | `OPENAI_API_KEY`                                     | WF-03, WF-00              |
| Meta — Loteria Cursos     | Header Auth | `Authorization: Bearer META_ACCESS_TOKEN`            | WF-04, WF-06, WF-00       |
| Webhook — Loteria Cursos  | Header Auth | `X-LC-Token: N8N_WEBHOOK_TOKEN`                      | webhooks do WF-07 e WF-00 |

**Criar à mão (alternativa):** na interface do n8n, _Credentials → Add credential_, use exatamente os nomes
acima. Depois, em cada workflow, abra os nodes marcados com aviso de credencial e selecione a credencial
correspondente (o JSON referencia por ID; credenciais criadas à mão têm outro ID). Por isso o script é o
caminho recomendado.

## Importar, publicar e atualizar workflows

```bash
npm run workflows:validate          # valida os JSON (estrutura, ligações, referências, segredos)
bash scripts/import-workflows.sh    # credenciais + import + publish + restart
```

Por baixo (sintaxe conferida no n8n 2.41.5):

```bash
docker compose exec -T n8n n8n import:workflow --separate --input=/import/workflows
docker compose exec -T n8n n8n publish:workflow --id=LcWf07Orchestr00   # um por workflow
docker compose restart n8n
```

Importar de novo **sobrescreve** os workflows com o mesmo ID (é assim que atualizações chegam).
Se você editar um workflow na interface, exporte-o antes de reimportar, senão a edição é substituída.

**Editar os workflows:** a fonte da verdade é `n8n/builder/*.mjs` (gera `n8n/workflows/*.json` com
`npm run workflows:build`). O validador falha se o JSON versionado divergir do gerado.

## IDs fixos

| Workflow                       | ID                 |
| ------------------------------ | ------------------ |
| WF-00-System-Health            | `LcWf00Health0000` |
| WF-01-Sync-Lottery-Results     | `LcWf01SyncRes000` |
| WF-02-Generate-Predictions     | `LcWf02Predict000` |
| WF-03-Render-Social-Post       | `LcWf03Render0000` |
| WF-04-Publish-Instagram        | `LcWf04Publish000` |
| WF-05-Check-Prediction-Results | `LcWf05Check00000` |
| WF-06-Instagram-Analytics      | `LcWf06Insights00` |
| WF-07-Content-Orchestrator     | `LcWf07Orchestr00` |
| WF-99-Global-Error-Handler     | `LcWf99ErrorHdl00` |

Todos têm _Settings → Error Workflow_ = WF-99, _Timezone_ = America/Bahia, _Execution order_ = v1.

## Teste manual (sem esperar o horário do sorteio)

```bash
curl -s -X POST http://localhost:5678/webhook/loteria-cursos/run \
  -H "X-LC-Token: $N8N_WEBHOOK_TOKEN" -H "Content-Type: application/json" \
  -d '{"game":"megasena","action":"result","dry_run":true}'
```

Ações: `result`, `poll` (força o polling agora), `prediction`, `check` (`contest`), `backfill` (`count`),
`requeue` (`post_id`), `health`, `insights`, `test_error` (testa o WF-99). `dry_run` é **true** se omitido.

Resposta (exemplo real do E2E):

```json
{
  "ok": true,
  "outcome": "INSERTED",
  "game": "megasena",
  "contest": 3065,
  "numbers": [4, 17, 28, 39, 44, 57],
  "caption": "Saiu o resultado da Mega-Sena\n\nMega-Sena • Concurso 3065 • 01/10/2026\nDezenas sorteadas: 04 · 17 · 28 · 39 · 44 · 57 …",
  "image_url": "…/social-media/megasena/results/megasena-result-3065-feed-dryrun.jpg",
  "instagram_publish": "SKIPPED_DRY_RUN",
  "post_status": "PUBLISHED_SIMULATED"
}
```

## Agenda

O WF-07 roda a cada 10 minutos e pergunta ao banco (`lc_due_jobs`) o que está vencido — os horários
**não** estão nos workflows, e sim em `lottery_games.draw_schedule` (fuso `America/Bahia`). WF-00 roda a
cada 6h e WF-06 todo dia às 09:12.

## Pinning / mocking no editor

Para testar um workflow no editor sem chamar serviços, use _Pin data_ nos nodes HTTP (n8n permite fixar a
saída de um node). Para testes repetíveis, prefira o ambiente E2E com simuladores (`docs/TESTING.md`).
Lembrete: o Error Trigger **não** dispara em execuções manuais do editor — use a ação `test_error`.
