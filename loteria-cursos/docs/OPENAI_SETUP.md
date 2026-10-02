# OpenAI — configuração

> Conferido no SDK oficial `openai` 7.27.0 (tipos da Responses API) — o site da OpenAI estava bloqueado na
> rede de desenvolvimento. **NÃO TESTADO CONTRA API REAL** (sem chave); testado contra o simulador, que
> recusa pedidos fora do contrato.

## O que a IA faz (e o que não faz)

A IA escreve **só**: título (headline), texto curto da legenda, CTA, até 5 hashtags e texto alternativo.
Ela **não** recebe a tarefa de escrever dezenas, concurso, datas ou valores — esses dados entram na legenda
por código. Também não gera números de palpite nem conta acertos.

## Chamada

`POST {OPENAI_BASE_URL}/responses` (Responses API) com **Structured Outputs**:

```json
{
  "model": "<OPENAI_MODEL>",
  "instructions": "regras editoriais em português…",
  "input": "Escreva a legenda para este post: {\"tipo_de_conteudo\":\"RESULT\",\"modalidade\":\"Mega-Sena\",…}",
  "text": { "format": { "type": "json_schema", "name": "instagram_caption", "strict": true,
            "schema": { "type": "object", "additionalProperties": false,
                        "required": ["headline","caption","cta","hashtags","alt_text"], "properties": { … } } } },
  "max_output_tokens": 2000,
  "store": false
}
```

O corpo é montado por `buildCaptionRequest()` (`packages/lottery-core/src/content/caption.ts`) e gravado no
post; o n8n só acrescenta o modelo configurado e envia com a credencial **OpenAI — Loteria Cursos**.

## Validação da resposta (antes de seguir)

`finalizeCaption()` (engine `/v1/content/caption-finalize`):

1. HTTP: 429/5xx/timeout → tenta de novo com backoff (5s, 15s…); 400/401/403/404 → reserva imediata.
2. Extrai o texto do item `message` (ignora itens de raciocínio); recusa (`refusal`) → reserva.
3. `status` ≠ `completed` (ex.: `incomplete` por limite de tokens) → tenta de novo.
4. `JSON.parse` + schema (zod) com limites de tamanho e no máximo 5 hashtags.
5. Regras editoriais: proíbe "números garantidos", "palpite certeiro", "vai ganhar", "chance garantida",
   "método infalível", "aumenta suas chances" etc. (negação como "sem garantia de acerto" é permitida).
6. Integridade: o texto da IA não pode listar dezenas, citar valores em R$ ou outro número de concurso.
7. O CTA configurado (`DEFAULT_CTA`) sempre prevalece.

Esgotou as tentativas (`openai_max_attempts`, padrão 3) → **legenda de reserva determinística**:

```
RESULTADO MEGA-SENA

Mega-Sena • Concurso 3065 • 01/10/2026
Dezenas sorteadas: 04 · 17 · 28 · 39 · 44 · 57

Confira sempre as informações oficiais.
…CTA, aviso legal e hashtags da modalidade
```

O post segue normalmente (`caption_source = 'fallback'`). Falha de IA nunca apaga nem altera dado oficial.

## Configuração

1. Crie a chave em <https://platform.openai.com/api-keys>.
2. `.env`: `OPENAI_API_KEY=…` e `OPENAI_MODEL=…` (sugestão: `gpt-5.4-mini` — barato e suficiente para
   legendas; confira os modelos disponíveis na sua conta).
3. `bash scripts/import-workflows.sh` (atualiza a credencial) e `docker compose up -d migrate` (atualiza o modelo
   em `system_settings`).
4. Health check: `services.openai = ok` (usa só `GET /models/{modelo}`, que não gera custo).

`OPENAI_MODEL` vazio = a IA não é chamada e todo post usa a legenda de reserva (útil para começar sem custo).

Custo estimado: ~1 chamada por post (até 3 em caso de falha), ~500–2.000 tokens cada.
