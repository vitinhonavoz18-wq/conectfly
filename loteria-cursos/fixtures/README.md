# Fixtures (respostas simuladas)

**Todos os números, datas, valores e IDs aqui são FICTÍCIOS.** Não são resultados reais de loteria.

- `caixa/` — JSON no formato do endpoint do portal de Loterias da CAIXA. Os **nomes dos campos** são os reais
  (conferidos na biblioteca pública `loteria-caixa`); os valores são inventados.
  - `invalid/` — variações que DEVEM ser bloqueadas (dezena repetida, fora do intervalo, quantidade errada,
    modalidade errada, ordem do sorteio divergente, data impossível/futura, campo faltando, número como texto,
    próximo concurso errado).
  - `not-ready/` — concurso sem dezenas publicadas ainda.
  - `conflict/` — mesmo concurso 3065 com uma dezena diferente (testa DATA_CONFLICT).
- `meta/` — respostas no formato da Graph API (container criado, status, publicado, erros 190/10/100/4/2/9007, insights).
- `openai/` — respostas da Responses API (legenda válida, linguagem proibida, IA listando dezenas, JSON inválido,
  schema errado, recusa, incompleta, erros 401/500).

Gerar de novo: `node scripts/generate-fixtures.mjs`.
