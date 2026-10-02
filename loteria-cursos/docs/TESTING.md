# Testes

| Camada     | Comando                      | Precisa de                                 | O que prova                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitários  | `npm test`                   | nada                                       | regras puras: validador, normalizador CAIXA, gerador (4 modalidades, sementes), conferência, idempotência, schema/compliance da legenda, classificação Meta, retry/backoff, máquina de estados, redação de segredos, renderer (dimensão, MIME, templates, regressão visual), engine HTTP, workflows (validador, Code nodes) |
| Integração | `npm run test:integration`   | Docker (sobe um PostgreSQL 17 descartável) | migrations, triggers, constraints, máquina de estados SQL = TS, concorrência (UNIQUE/ON CONFLICT/CAS), circuit breaker, agenda, RLS, e os 8 cenários com engine + renderer + simuladores por HTTP real                                                                                                                      |
| E2E        | `npm run test:e2e`           | Docker                                     | stack completa com **n8n 2.41.5 real**: importa e publica os workflows, roda os cenários pelo webhook e confere o banco e as chamadas aos simuladores                                                                                                                                                                       |
| Real       | `npm run test:real`          | credenciais + travas                       | APIs de verdade (veja abaixo)                                                                                                                                                                                                                                                                                               |
| Workflows  | `npm run workflows:validate` | nada                                       | JSON válido, idêntico ao builder, ligações, referências `$('Node')`, sintaxe das expressões e Code nodes, credenciais sem dados, webhooks autenticados                                                                                                                                                                      |
| Segurança  | `npm run security:scan`      | git, npm                                   | `.env` fora do git, padrões de segredo, workflows limpos, portas só em 127.0.0.1, `npm audit`                                                                                                                                                                                                                               |

Tudo de uma vez: `npm run test:all` (lint + typecheck + unit + workflows + integração + E2E).

## Cenários obrigatórios (integração **e** E2E)

| #   | Cenário                                        | Esperado                                                         | Onde  |
| --- | ---------------------------------------------- | ---------------------------------------------------------------- | ----- |
| 1   | Novo concurso → salvar → post → arte → dry run | 1 draw, 1 social_post, 0 publicação real (`PUBLISHED_SIMULATED`) | ambos |
| 2   | Mesmo concurso 2× (e 2 execuções simultâneas)  | 1 draw, 1 post                                                   | ambos |
| 3   | Payload da loteria inválido                    | FAIL, nada gravado, nada publicado, erro registrado              | ambos |
| 4   | OpenAI fora do ar                              | retry controlado → legenda de reserva; resultado preservado      | ambos |
| 5   | Meta 429                                       | backoff (Retry-After) + retry → publicado                        | ambos |
| 6   | Token inválido                                 | 1 chamada só, FAILED, erro registrado, circuito conta falha      | ambos |
| 7   | Renderer/Storage falha                         | FAILED, sem chamada à Meta, erro no WF-99                        | ambos |
| 8   | Container nunca FINISHED                       | timeout, FAILED, **0** `media_publish`                           | ambos |

Extras no E2E: 4 modalidades, DATA_CONFLICT, palpite → resultado → conferência automática, polling com backoff
e parada garantida, backfill, analytics (incluindo métrica recusada pela Meta), health check, Error Trigger do
WF-99 (`test_error`), e varredura de segredos no banco.

## Simuladores (mocks)

`apps/mock-server` imita CAIXA, OpenAI (Responses API), Meta (container/status/publish/insights/me) e Supabase
Storage, com comportamento controlado por cenário:

```bash
curl -X POST localhost:4010/__admin/scenario -d '{"meta":{"publish_mode":"rate_limit","publish_fail_times":1}}' -H 'Content-Type: application/json'
curl localhost:4010/__admin/calls?service=meta      # o que foi chamado
curl -X POST localhost:4010/__admin/reset
```

O simulador da Meta baixa a imagem pela URL pública e recusa o que não for JPEG (como a Meta real). O da OpenAI
recusa pedidos sem `text.format` `json_schema` `strict` (teste de contrato).

Fixtures em `fixtures/` (valores fictícios — ver `fixtures/README.md`). Para regenerar: `node scripts/generate-fixtures.mjs`.

## Regressão visual do renderer

`apps/renderer/tests/__snapshots__/render-hashes.json` guarda o hash das artes de referência. Mudou o layout de
propósito? `UPDATE_RENDER_SNAPSHOTS=1 npm test` e confira as imagens geradas.

## Teste real (REAL_INTEGRATION_TEST)

```bash
set -a; . ./.env; set +a
RUN_REAL_INTEGRATION_TESTS=true npm run test:real                                  # só leitura
RUN_REAL_INTEGRATION_TESTS=true ENABLE_REAL_INSTAGRAM_PUBLISH=true \
  REAL_TEST_IMAGE_URL=https://<id>.supabase.co/storage/v1/object/public/social-media/... npm run test:real   # PUBLICA 1 post
```

Leitura: CAIXA, OpenAI (legenda real validada), Meta (`/me` e `content_publishing_limit`). Publicação: só com as
**duas** variáveis em `true`. Sem elas, os testes são pulados.

## Resultado da última execução (02/10/2026)

- Unitários: **163/163** · Integração: **33/33** · E2E (n8n 2.41.5 real): **24/24** · Real: pulado (sem credenciais).
