// Gera as fixtures de contrato (respostas simuladas de CAIXA, Meta e OpenAI).
// IMPORTANTE: números, datas e valores são FICTÍCIOS. Os NOMES dos campos da CAIXA
// seguem exatamente os expostos pelo endpoint (ver docs/LOTTERY_SOURCE.md).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const write = (rel, data) => {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};
const pad = (n) => String(n).padStart(2, "0");

function caixa({
  tipoJogo,
  numero,
  data,
  proxData,
  ordem,
  acumulado = false,
  estimativa = 3500000,
}) {
  const lista = [...ordem].sort((a, b) => a - b).map(pad);
  return {
    acumulado,
    dataApuracao: data,
    dataProximoConcurso: proxData,
    dezenasSorteadasOrdemSorteio: ordem.map(pad),
    id: null,
    indicadorConcursoEspecial: 1,
    listaDezenas: lista,
    listaDezenasSegundoSorteio: null,
    listaMunicipioUFGanhadores: [],
    listaRateioPremio: [],
    listaResultadoEquipeEsportiva: null,
    localSorteio: "ESPAÇO DA SORTE",
    nomeMunicipioUFSorteio: "SÃO PAULO, SP",
    nomeTimeCoracaoMesSorte: "",
    numero,
    numeroConcursoAnterior: numero - 1,
    numeroConcursoFinal_0_5: numero + 15,
    numeroConcursoProximo: numero + 1,
    numeroJogo: 2,
    observacao: "",
    tipoJogo,
    tipoPublicacao: 3,
    valorAcumuladoConcurso_0_5: 0,
    valorAcumuladoConcursoEspecial: 0,
    valorAcumuladoProximoConcurso: 0,
    valorArrecadado: 12345678.9,
    valorEstimadoProximoConcurso: estimativa,
    valorTotalPremioFaixaUm: 0,
  };
}

const mega = caixa({
  tipoJogo: "MEGA_SENA",
  numero: 3065,
  data: "01/10/2026",
  proxData: "04/10/2026",
  ordem: [39, 4, 57, 17, 44, 28],
  acumulado: true,
  estimativa: 45000000,
});
const mega3064 = caixa({
  tipoJogo: "MEGA_SENA",
  numero: 3064,
  data: "29/09/2026",
  proxData: "01/10/2026",
  ordem: [10, 23, 5, 48, 60, 31],
});
const lotofacil = caixa({
  tipoJogo: "LOTOFACIL",
  numero: 3502,
  data: "01/10/2026",
  proxData: "02/10/2026",
  ordem: [3, 18, 1, 25, 7, 12, 9, 20, 2, 14, 23, 5, 16, 11, 22],
  estimativa: 1800000,
});
const quina = caixa({
  tipoJogo: "QUINA",
  numero: 6870,
  data: "01/10/2026",
  proxData: "02/10/2026",
  ordem: [77, 3, 41, 18, 62],
  acumulado: true,
  estimativa: 7200000,
});
const lotomania = caixa({
  tipoJogo: "LOTOMANIA",
  numero: 2860,
  data: "30/09/2026",
  proxData: "02/10/2026",
  ordem: [0, 99, 12, 45, 67, 3, 88, 21, 34, 56, 78, 90, 11, 23, 47, 59, 61, 72, 84, 95],
  estimativa: 2500000,
});

write("caixa/megasena.json", mega);
// Concurso seguinte (para testar palpite → resultado → conferência).
write(
  "caixa/megasena-3066.json",
  caixa({
    tipoJogo: "MEGA_SENA",
    numero: 3066,
    data: "02/10/2026",
    proxData: "04/10/2026",
    ordem: [4, 10, 28, 39, 51, 60],
    estimativa: 50000000,
  }),
);
write("caixa/megasena-3064.json", mega3064);
write("caixa/lotofacil.json", lotofacil);
write("caixa/quina.json", quina);
write("caixa/lotomania.json", lotomania);

// Variações inválidas (cada uma deve BLOQUEAR a publicação).
write("caixa/invalid/megasena-duplicate-numbers.json", {
  ...mega,
  listaDezenas: ["04", "04", "28", "39", "44", "57"],
  dezenasSorteadasOrdemSorteio: null,
});
write("caixa/invalid/megasena-out-of-range.json", {
  ...mega,
  listaDezenas: ["04", "17", "28", "39", "44", "61"],
  dezenasSorteadasOrdemSorteio: null,
});
write("caixa/invalid/megasena-wrong-count.json", {
  ...mega,
  listaDezenas: ["04", "17", "28", "39", "44"],
  dezenasSorteadasOrdemSorteio: null,
});
write("caixa/invalid/megasena-wrong-game.json", { ...mega, tipoJogo: "QUINA" });
write("caixa/invalid/megasena-order-mismatch.json", {
  ...mega,
  dezenasSorteadasOrdemSorteio: ["39", "04", "57", "17", "44", "29"],
});
write("caixa/invalid/megasena-bad-date.json", { ...mega, dataApuracao: "31/02/2026" });
write("caixa/invalid/megasena-future-date.json", {
  ...mega,
  dataApuracao: "01/10/2099",
  dataProximoConcurso: "04/10/2099",
});
const { listaDezenas: _omit, ...missing } = mega;
write("caixa/invalid/megasena-missing-field.json", missing);
write("caixa/invalid/megasena-text-number.json", { ...mega, numero: "3065" });
write("caixa/invalid/megasena-next-contest-mismatch.json", {
  ...mega,
  numeroConcursoProximo: 3070,
});
write("caixa/not-ready/megasena.json", {
  ...mega,
  listaDezenas: [],
  dezenasSorteadasOrdemSorteio: [],
});
// Mesmo concurso 3065 com dezenas diferentes → DATA_CONFLICT.
write(
  "caixa/conflict/megasena-3065-different.json",
  caixa({
    tipoJogo: "MEGA_SENA",
    numero: 3065,
    data: "01/10/2026",
    proxData: "04/10/2026",
    ordem: [39, 4, 57, 17, 44, 29],
    acumulado: true,
    estimativa: 45000000,
  }),
);

// ---------------- Meta / Instagram Graph API ----------------
const graphError = (message, type, code, error_subcode, extra = {}) => ({
  error: {
    message,
    type,
    code,
    ...(error_subcode ? { error_subcode } : {}),
    fbtrace_id: "AFixtureTrace000",
    ...extra,
  },
});
write("meta/container-created.json", { id: "17900000000000001" });
write("meta/container-in-progress.json", { status_code: "IN_PROGRESS", id: "17900000000000001" });
write("meta/container-finished.json", { status_code: "FINISHED", id: "17900000000000001" });
write("meta/container-error.json", {
  status_code: "ERROR",
  status: "Error: media processing failed",
  id: "17900000000000001",
});
write("meta/container-expired.json", { status_code: "EXPIRED", id: "17900000000000001" });
write("meta/container-published.json", { status_code: "PUBLISHED", id: "17900000000000001" });
write("meta/media-published.json", { id: "17800000000000009" });
write("meta/me.json", {
  user_id: "17841400000000000",
  username: "loteriacursos",
  id: "17841400000000000",
});
write("meta/publishing-limit.json", {
  data: [{ quota_usage: 2, config: { quota_total: 100, quota_duration: 86400 } }],
});
write("meta/insights.json", {
  data: [
    {
      name: "views",
      period: "lifetime",
      values: [{ value: 1520 }],
      title: "Views",
      id: "17800000000000009/insights/views/lifetime",
    },
    {
      name: "reach",
      period: "lifetime",
      values: [{ value: 1100 }],
      title: "Reach",
      id: "17800000000000009/insights/reach/lifetime",
    },
    {
      name: "likes",
      period: "lifetime",
      values: [{ value: 87 }],
      title: "Likes",
      id: "17800000000000009/insights/likes/lifetime",
    },
  ],
});
write(
  "meta/error-rate-limit.json",
  graphError("Application request limit reached", "OAuthException", 4, null, {
    is_transient: true,
  }),
);
write(
  "meta/error-invalid-token.json",
  graphError("Error validating access token: Session has expired.", "OAuthException", 190, 463),
);
write(
  "meta/error-permission.json",
  graphError("Application does not have permission for this action", "OAuthException", 10),
);
write(
  "meta/error-media-not-ready.json",
  graphError("Media ID is not available", "OAuthException", 9007, 2207027),
);
write(
  "meta/error-invalid-parameter.json",
  graphError("Invalid parameter", "OAuthException", 100, 2207004),
);
write(
  "meta/error-server.json",
  graphError(
    "An unexpected error has occurred. Please retry your request later.",
    "OAuthException",
    2,
    null,
    { is_transient: true },
  ),
);

// ---------------- OpenAI Responses API ----------------
const response = (text, extra = {}) => ({
  id: "resp_fixture_0001",
  object: "response",
  created_at: 1790000000,
  status: "completed",
  model: "gpt-fixture",
  output: [
    { id: "rs_fixture", type: "reasoning", summary: [] },
    {
      id: "msg_fixture",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text, annotations: [] }],
    },
  ],
  usage: { input_tokens: 420, output_tokens: 180, total_tokens: 600 },
  ...extra,
});
const caption = {
  headline: "Resultado fresquinho da Mega-Sena",
  caption:
    "Saiu o resultado de hoje! Confira as dezenas na arte e compare com o seu jogo. Conteúdo informativo para você acompanhar com a gente.",
  cta: 'Comente "EU QUERO" para continuar acompanhando nossos palpites e resultados.',
  hashtags: ["#megasena", "#loteria", "#resultado"],
  alt_text: "Arte verde com o logotipo Loteria Cursos e as seis dezenas sorteadas da Mega-Sena.",
};
write("openai/caption.json", response(JSON.stringify(caption)));
write(
  "openai/caption-forbidden.json",
  response(
    JSON.stringify({
      ...caption,
      caption: "Palpite certeiro! Com esse método infalível você vai ganhar.",
    }),
  ),
);
write(
  "openai/caption-lists-numbers.json",
  response(
    JSON.stringify({ ...caption, caption: "As dezenas foram 04, 17, 28, 39 e 44. Confira!" }),
  ),
);
write("openai/caption-invalid-json.json", response("Aqui está a sua legenda: Resultado da Mega!"));
write("openai/caption-wrong-schema.json", response(JSON.stringify({ title: "x", text: "y" })));
write("openai/refusal.json", {
  ...response(""),
  output: [
    {
      id: "msg_fixture",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "refusal", refusal: "I can't help with that." }],
    },
  ],
});
write("openai/incomplete.json", {
  ...response('{"headline":"Resul'),
  status: "incomplete",
  incomplete_details: { reason: "max_output_tokens" },
});
write("openai/error-500.json", {
  error: {
    message: "The server had an error while processing your request.",
    type: "server_error",
    param: null,
    code: null,
  },
});
write("openai/error-401.json", {
  error: {
    message: "Incorrect API key provided.",
    type: "invalid_request_error",
    param: null,
    code: "invalid_api_key",
  },
});
write("openai/model.json", {
  id: "gpt-fixture",
  object: "model",
  created: 1790000000,
  owned_by: "system",
});
console.log("fixtures geradas em", root);
