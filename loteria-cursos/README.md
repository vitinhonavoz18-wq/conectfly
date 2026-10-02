# Loteria Cursos — Social Media Automation

Automação que **busca os resultados oficiais** da Mega-Sena, Lotofácil, Quina e Lotomania, **gera palpites**,
**confere** os palpites, **cria a arte e a legenda** e **publica no Instagram** pela API oficial da Meta —
com o n8n como orquestrador.

```
CAIXA → n8n → resultado/palpite → validação → OpenAI (só texto) → arte Loteria Cursos → Supabase → Instagram API → métricas
```

**Segurança por padrão:** enquanto `ENABLE_REAL_INSTAGRAM_PUBLISH=false`, tudo roda (resultado, legenda, arte,
registro) mas **a Meta não recebe nenhuma publicação** (modo _dry run_).

> Projeto independente dentro do repositório `conectfly` (não interfere no site de pedidos).

## Como funciona, em uma frase por peça

- **n8n** decide _quando_ e _o quê_ (agenda, esperas, decisões, chamadas externas com as credenciais).
- **engine** (Lottery Core) faz o que precisa ser exato: lê a CAIXA, valida as dezenas, gera e confere palpites,
  monta o plano do post e checa a legenda da IA. Tudo testado.
- **renderer** desenha a arte (JPEG) com templates fixos — a IA não escreve nada dentro da imagem.
- **PostgreSQL** é a fonte da verdade e a trava final contra duplicidade (cada post tem um "número de pedido"
  único: `result:megasena:3065:feed`).
- **IA (OpenAI)** só escreve o texto da legenda; dezenas, concurso e valores entram por código.

Detalhes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
loteria-cursos/
├── n8n/workflows/          9 workflows importáveis (WF-00 … WF-07, WF-99)
├── n8n/builder/            fonte dos workflows (gera os JSON)
├── apps/engine/            Lottery Core API (Fastify)
├── apps/renderer/          artes (Satori + resvg + sharp) + Storage
├── apps/mock-server/       simuladores de CAIXA/OpenAI/Meta/Storage (testes)
├── packages/lottery-core/  regras: validação, normalização, palpites, conferência, legendas, Meta
├── packages/shared/        logs, retry/backoff, hash, redação de segredos
├── database/               migrations, seeds e migrador
├── fixtures/               respostas simuladas (valores fictícios)
├── tests/                  integração, E2E e teste real
├── scripts/                setup, importação, validação, testes, segurança
└── docs/                   guias
```

---

## Passo a passo do zero

### 1. Requisitos

- Computador/servidor com **Docker** (Compose v2) e **Node.js 22+** (só para os scripts).
- Para produção: domínio com HTTPS para o n8n (webhooks), conta **OpenAI**, conta **Instagram Profissional** +
  app na **Meta**, projeto **Supabase** (Storage público). Sem eles o sistema roda em dry run.

### 2. Instalar o Docker

<https://docs.docker.com/get-docker/> (Docker Desktop no Windows/Mac; Docker Engine no Linux). Confira:

```bash
docker --version && docker compose version && node --version
```

### 3. Configurar o `.env`

```bash
cd loteria-cursos
bash scripts/setup.sh        # na primeira vez cria o .env com senhas aleatórias e já sobe tudo (passos 4–8)
```

Ou manualmente: `cp .env.example .env` e preencha `POSTGRES_PASSWORD`, `N8N_ENCRYPTION_KEY`
(`openssl rand -hex 32`) e `N8N_WEBHOOK_TOKEN` (`openssl rand -hex 24`). **Guarde a `N8N_ENCRYPTION_KEY`**.

### 4. Subir o projeto

```bash
docker compose up -d --build
docker compose ps            # postgres, engine, renderer e n8n "healthy"; migrate "exited (0)"
```

Se estiver atrás de proxy corporativo com certificado próprio: `EXTRA_CA_CERT_FILE=/caminho/ca.pem bash scripts/setup.sh`.

### 5. Aplicar migrations

Automático: o serviço `migrate` roda a cada `docker compose up` (migrations + seeds + configurações do `.env`).
Manual: `docker compose up migrate`.

### 6. Abrir o n8n

<http://localhost:5678> — no primeiro acesso crie o **usuário dono** (e-mail/senha seus).

### 7. Importar os workflows

```bash
bash scripts/import-workflows.sh     # valida, cria credenciais, importa, PUBLICA os 9 e reinicia o n8n
```

### 8. Criar as credenciais

Feito pelo passo 7 a partir do `.env` (4 credenciais: Postgres, OpenAI, Meta, Webhook — nomes e IDs em
[`docs/N8N_SETUP.md`](docs/N8N_SETUP.md)). Mudou alguma chave no `.env`? Rode o passo 7 de novo.

### 9. Configurar a OpenAI

`OPENAI_API_KEY` e `OPENAI_MODEL` no `.env` → passo 7 → `docker compose up -d migrate`.
Guia: [`docs/OPENAI_SETUP.md`](docs/OPENAI_SETUP.md).

### 10. Configurar a Meta

`META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_GRAPH_HOST`, `META_GRAPH_API_VERSION`.
Guia (permissões, token de 60 dias e renovação): [`docs/META_SETUP.md`](docs/META_SETUP.md).

### 11. Configurar o Supabase

Bucket público `social-media` + `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Guia: [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).

### 12. Executar um dry run

```bash
set -a; . ./.env; set +a
curl -s -X POST http://localhost:5678/webhook/loteria-cursos/run \
  -H "X-LC-Token: $N8N_WEBHOOK_TOKEN" -H "Content-Type: application/json" \
  -d '{"game":"megasena","action":"result","dry_run":true}'
```

Resposta:

```json
{
  "game": "megasena",
  "contest": 3065,
  "numbers": [4, 17, 28, 39, 44, 57],
  "caption": "…",
  "image_url": "…/megasena-result-3065-feed-dryrun.jpg",
  "instagram_publish": "SKIPPED_DRY_RUN"
}
```

Outras ações: `poll`, `prediction`, `check` (com `contest`), `backfill` (com `count`), `requeue` (com `post_id`),
`health`, `insights`, `test_error`. Saúde geral: `GET /webhook/loteria-cursos/health` (mesmo header).

Dica: rode `{"game":"megasena","action":"backfill","count":50}` uma vez para os palpites terem histórico.

### 13. Executar os testes

```bash
npm ci                    # dependências (para ADICIONAR pacotes use `npx npm@11 install …`: o npm 10 tem um bug nesse caso)
npm test                  # unitários
npm run test:integration  # PostgreSQL real em container descartável
npm run test:e2e          # stack completa com n8n real e simuladores
npm run security:scan
```

Detalhes: [`docs/TESTING.md`](docs/TESTING.md).

### 14. Ativar os workflows

Já ficam **publicados** pelo passo 7 (no n8n 2.x "publicar" substitui o antigo "ativar"). A agenda (WF-07,
a cada 10 min) só age nos horários configurados em `lottery_games`. Para pausar tudo:
`docker compose exec n8n n8n unpublish:workflow --all && docker compose restart n8n`.

### 15. Habilitar a publicação real

Checklist antes de virar a chave:

1. WF-00 (health) com `openai`, `meta`, `storage` = `ok` e `STORAGE_DRIVER=supabase`.
2. Alguns dias em dry run conferindo as artes/legendas (`SELECT * FROM v_post_overview`).
3. No `.env`: `ENABLE_REAL_INSTAGRAM_PUBLISH=true` → `docker compose up -d migrate`.
4. Primeiro post real manual: `{"game":"megasena","action":"result","dry_run":false}`.

Para desligar: volte para `false` e `docker compose up -d migrate` (vale na próxima publicação).

---

## Operação do dia a dia

| Quero…                          | Faça                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Ver posts                       | `SELECT * FROM v_post_overview ORDER BY created_at DESC;`                            |
| Ver erros                       | `SELECT * FROM workflow_errors ORDER BY occurred_at DESC;`                           |
| Reprocessar post que falhou     | ação `requeue` com `post_id` (só se nada foi publicado)                              |
| Mudar horário de sorteio        | `UPDATE lottery_games SET draw_schedule = '…'`                                       |
| Mudar cor da modalidade         | `UPDATE lottery_games SET brand_color = '#…'`                                        |
| Mudar CTA/marca                 | `.env` (`DEFAULT_CTA`, `BRAND_NAME`) + `docker compose up -d migrate`                |
| Comparar desempenho             | `SELECT * FROM v_content_performance_summary;`                                       |
| Renovar token da Meta (60 dias) | [`docs/META_SETUP.md`](docs/META_SETUP.md#ciclo-de-vida-do-token-login-do-instagram) |
| Receber alertas                 | `ALERT_WEBHOOK_URL` (POST JSON) no `.env` + `docker compose up -d migrate`           |

## Regras editoriais

Nunca: "números garantidos", "palpite certeiro", "vai ganhar", "chance garantida", "método infalível".
Sempre: "palpite gerado com auxílio de IA", "combinação criada a partir de critérios estatísticos", "conteúdo
recreativo". Estatística serve só para **diversificar** — em loteria justa todas as combinações têm a mesma
chance. Coincidência de dezenas **não** é prêmio (só a CAIXA confirma faixas).

## Avisos honestos

- O endpoint da CAIXA **não é API pública documentada** ([`docs/LOTTERY_SOURCE.md`](docs/LOTTERY_SOURCE.md)).
- OpenAI, Meta, Supabase e CAIXA **não foram testados contra as APIs reais** neste desenvolvimento (sem
  credenciais e com a rede bloqueada para esses sites); foram testados contra simuladores fiéis ao contrato.
- Horários dos sorteios conferidos em notícias de jul/2026 — confirme no site da CAIXA.
