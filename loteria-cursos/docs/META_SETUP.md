# Meta / Instagram — configuração

> **Transparência:** o site de documentação da Meta (developers.facebook.com) estava **bloqueado na rede
> do ambiente de desenvolvimento**. As informações abaixo foram conferidas por buscas (resumos da
> documentação oficial e guias de 2026) e pelo comportamento implementado; os **nomes exatos de menus**
> do painel da Meta mudam com frequência e não puderam ser vistos ao vivo. Confira cada passo em
> <https://developers.facebook.com/docs/instagram-platform>. Nada aqui foi testado contra a API real
> (não havia credenciais) — **NÃO TESTADO CONTRA API REAL**.

## Decisão: qual login usar

A Meta oferece duas formas de acessar a Instagram API para contas profissionais:

|                                | Instagram API **com Login do Instagram**                         | Instagram API **com Login do Facebook**                                                                           |
| ------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Host                           | `https://graph.instagram.com`                                    | `https://graph.facebook.com`                                                                                      |
| Precisa de Página do Facebook? | **Não**                                                          | Sim (vinculada à conta do Instagram)                                                                              |
| Permissões de publicação       | `instagram_business_basic`, `instagram_business_content_publish` | `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` (e `business_management` em alguns casos) |
| Métricas (WF-06)               | `instagram_business_manage_insights`                             | `instagram_manage_insights`                                                                                       |
| Token                          | Instagram User token de longa duração (60 dias, renovável)       | Token de usuário/página ou System User do Business Manager                                                        |

**Escolhido: Login do Instagram** — é o caminho mais simples para **uma** conta profissional própria
(sem depender de Página do Facebook). O sistema funciona com os dois: basta trocar
`META_GRAPH_HOST` no `.env` e usar o token correspondente.

Consequência importante: o token de longa duração do Login do Instagram **vale 60 dias** e precisa ser
renovado antes de vencer (veja "Ciclo de vida do token").

## Passo a passo

1. **Conta do Instagram profissional.** No app do Instagram, a conta precisa ser _Profissional_
   (Empresa ou Criador de conteúdo).
2. **Criar o app na Meta.** Em <https://developers.facebook.com/apps>, crie um app e adicione o caso de
   uso/produto da **Instagram API** ("API with Instagram Login").
3. **Permissões.** Solicite `instagram_business_basic`, `instagram_business_content_publish` e (para
   métricas) `instagram_business_manage_insights`. Para publicar na sua própria conta, que é
   administrada por você no app, o modo de desenvolvimento costuma bastar; para outras contas é preciso
   passar pela _App Review_.
4. **Gerar o token.** No painel do app, na configuração da API com Login do Instagram, adicione a sua
   conta do Instagram (como testador/administrador) e gere o token de acesso. O token gerado pelo painel
   já é de longa duração; se você fizer o fluxo OAuth completo, troque o token curto pelo longo
   (`GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=…&access_token=…`).
5. **Descobrir o Instagram User ID.**
   ```bash
   curl -s -H "Authorization: Bearer $META_ACCESS_TOKEN" \
     "https://graph.instagram.com/v26.0/me?fields=user_id,username"
   ```
   Use o `user_id` em `META_IG_USER_ID`.
6. **Versão da API.** `META_GRAPH_API_VERSION=v26.0` (atual em out/2026, lançada em 29/07/2026). Confira
   em <https://developers.facebook.com/docs/graph-api/changelog/versions> e ajuste — o valor é só configuração.
7. **Preencher o `.env`** (`META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_GRAPH_HOST`,
   `META_GRAPH_API_VERSION`) e rodar `bash scripts/import-workflows.sh` (recria a credencial
   **"Meta — Loteria Cursos"** com o token novo) e `docker compose up -d migrate` (atualiza as configurações).
   Alternativa manual: no n8n, _Credentials → Meta — Loteria Cursos_ (tipo **Header Auth**), Name
   `Authorization`, Value `Bearer SEU_TOKEN`.
8. **Testar o acesso sem publicar:** rode o WF-00 (health) — `services.meta` deve ficar `ok`:
   ```bash
   curl -s -H "X-LC-Token: $N8N_WEBHOOK_TOKEN" http://localhost:5678/webhook/loteria-cursos/health
   ```
9. **Publicação de teste.** Com `ENABLE_REAL_INSTAGRAM_PUBLISH=true` no `.env` e o Supabase Storage
   configurado (a Meta precisa baixar a imagem de uma URL **pública**), rode:
   ```bash
   curl -s -X POST http://localhost:5678/webhook/loteria-cursos/run \
     -H "X-LC-Token: $N8N_WEBHOOK_TOKEN" -H "Content-Type: application/json" \
     -d '{"game":"megasena","action":"result","dry_run":false}'
   ```
   Ou o teste automatizado (exige as duas travas): veja `docs/TESTING.md` → "Teste real".

## Como a publicação funciona (fluxo oficial de 2 etapas)

1. `POST /{ig-user-id}/media` com `image_url` e `caption` → devolve o **container** (`id`).
   Stories: `media_type=STORIES`; Reels: `media_type=REELS` + `video_url`; carrossel: itens com
   `is_carousel_item=true` e depois um container `media_type=CAROUSEL` com `children` (até 10).
2. `GET /{container-id}?fields=status_code,status` até `FINISHED`. Estados documentados:
   `IN_PROGRESS`, `FINISHED`, `ERROR`, `EXPIRED` (não publicado em 24h) e `PUBLISHED`.
   Mesmo para imagem verificamos o status — publicar cedo demais gera o erro "Media ID is not available"
   (código 9007 / subcódigo 2207027).
3. `POST /{ig-user-id}/media_publish` com `creation_id` → devolve o **ID da mídia** publicado.

Regras que o sistema respeita:

- **Imagem: só JPEG** (por isso as artes são `.jpg`, não `.png`), proporção entre 4:5 e 1,91:1 — o feed
  usa 1080×1350 (4:5). Stories 1080×1920.
- **Limite: 100 publicações via API a cada 24h** (janela móvel; carrossel conta 1). Consulta:
  `GET /{ig-user-id}/content_publishing_limit`. Erro de limite → falha sem repetir.
- Token sempre no header `Authorization: Bearer …` (nunca na URL).
- `min_seconds_between_publishes` (padrão 60s) espaça publicações reais.

## Ciclo de vida do token (Login do Instagram)

- Token de longa duração: **60 dias**. Renovação: `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TOKEN_ATUAL`
  (o token precisa ter **mais de 24h** e **ainda estar válido**; o novo vale mais 60 dias).
- Token vencido **não** renova: é preciso gerar outro no painel.
- Recomendação: renovar a cada ~50 dias. Fluxo seguro com este projeto:
  1. rode a renovação (curl acima) no seu computador;
  2. cole o novo token em `META_ACCESS_TOKEN` no `.env`;
  3. `bash scripts/import-workflows.sh` (atualiza só a credencial e republica; não duplica nada).
- O WF-00 detecta token inválido (`services.meta = down`) e o WF-04 trata o erro 190 como **permanente**
  (não insiste, marca FAILED e registra em `workflow_errors`).

## Erros comuns

| Erro                            | Causa provável                                                 | O sistema faz                    |
| ------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| 190 / OAuthException            | token expirado ou revogado                                     | FAILED, sem retry, alerta        |
| 10, 200–299                     | permissão faltando                                             | FAILED, sem retry                |
| 100                             | parâmetro inválido (URL, legenda)                              | FAILED, sem retry                |
| 9004 / 2207052                  | Meta não conseguiu baixar a imagem (URL não pública, não JPEG) | retry curto; depois FAILED       |
| 9007 / 2207027                  | mídia ainda processando                                        | espera e tenta de novo           |
| 4, 17, 32, 613, 80002, HTTP 429 | limite de requisições                                          | backoff (respeita `Retry-After`) |
| 2207042                         | limite de publicações (24h) atingido                           | FAILED sem retry                 |

## Métricas (WF-06)

Endpoint: `GET /{ig-media-id}/insights?metric=…`. Em 2025 a Meta **substituiu `impressions` e `plays`
por `views`**, e continua mudando métricas. Por isso a lista fica em `system_settings.instagram_insight_metrics`
(padrão: `views, reach, likes, comments, shares, saved, total_interactions`). Se a Meta recusar alguma,
o WF-06 grava o erro em `instagram_insights.error` e segue — ajuste a lista sem mexer no workflow.
