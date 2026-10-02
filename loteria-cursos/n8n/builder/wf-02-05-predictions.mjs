import { WorkflowBuilder, WF, n, js, reportError } from "./lib.mjs";

// =====================================================================
// WF-02 — Palpites
// =====================================================================
export function buildPredictions() {
  const NAME = "WF-02-Generate-Predictions";
  const INPUT = "$('Validate — Prediction Input').first().json";
  const CTX = "$('DB — Load Prediction Context').first().json.ctx";
  const S = `${CTX}.settings`;
  const b = new WorkflowBuilder({
    id: WF.predict,
    name: NAME,
    description:
      "Gera palpites com algoritmo determinístico (lottery-core), valida, grava e dispara o conteúdo PREDICTION.",
    tags: ["loteria-cursos", "predictions"],
  });
  b.sticky(
    "## WF-02 — Palpites\n\n" +
      "Histórico → estatísticas descritivas → candidatos válidos por construção → seleção diversificada → **validação determinística** → banco.\n\n" +
      "O LLM **não** gera números. A semente é `jogo:concurso:método:versão` (reproduzível).\n\n" +
      "Aviso obrigatório: estatística serve só para diversificar; em loteria justa todas as combinações têm a mesma chance.",
    { height: 260, width: 520 },
  );
  const trigger = n.executeWorkflowTrigger(b, "Trigger — Prediction Request");
  const validate = n.code(
    b,
    "Validate — Prediction Input",
    `
const i = $input.item.json;
if (!/^[a-z0-9_]+$/.test(String(i.game ?? ''))) throw new Error('INVALID_PREDICTION_INPUT: game inválido');
const contest = i.contest === undefined || i.contest === null ? null : Number(i.contest);
if (contest !== null && (!Number.isInteger(contest) || contest < 1)) throw new Error('INVALID_PREDICTION_INPUT: contest inválido');
return { json: { game: i.game, contest, dry_run: i.dry_run === true, correlation_id: String(i.correlation_id ?? $execution.id) } };
`,
  );
  const load = n.pg(
    b,
    "DB — Load Prediction Context",
    "SELECT lc_prediction_context($1, $2::bigint, COALESCE((lc_settings()->>'prediction_history_size')::int, 100)) AS ctx",
    ["$json.game", "$json.contest"],
  );
  const ok = n.ifTrue(
    b,
    "Context — OK?",
    "$json.ctx.ok === true && $json.ctx.game.enabled === true",
  );
  const notOk = n.code(
    b,
    "Return — Prediction Skipped",
    `return { json: { ok: false, outcome: $json.ctx.outcome ?? 'GAME_DISABLED', message: $json.ctx.message ?? null, game: ${INPUT}.game } };`,
  );
  const exists = n.ifTrue(
    b,
    "Predictions — Already Exist?",
    "($json.ctx.existing ?? []).length > 0",
    "Idempotente: palpite do concurso já gerado é reaproveitado.",
  );
  const generate = n.http(b, "Engine — Generate Predictions", {
    method: "POST",
    url: `={{ ${S}.engine_url }}/v1/predictions/generate`,
    body: js(
      `{ game: ${CTX}.game, contest: ${CTX}.target_contest, history: ${CTX}.history, count: Number(${S}.prediction_bets ?? 1) }`,
    ),
    timeout: 60000,
  });
  const genOk = n.ifTrue(
    b,
    "Generation — OK?",
    "$json.statusCode === 200 && $json.body?.ok === true && ($json.body.predictions ?? []).length > 0",
  );
  const [genReportSet, genReport] = reportError(b, "Generation Failed", {
    code: "PREDICTION_GENERATION_FAILED",
    message:
      "=PREDICTION_GENERATION_FAILED {{ " +
      INPUT +
      ".game }}: {{ $json.body?.message ?? $json.error?.message ?? 'engine indisponível' }}",
    payload: `{ game: ${INPUT}.game, contest: ${CTX}.target_contest }`,
    workflowName: NAME,
  });
  const genFailed = n.code(
    b,
    "Return — Generation Failed",
    `return { json: { ok: false, outcome: 'PREDICTION_GENERATION_FAILED', game: ${INPUT}.game } };`,
  );
  const save = n.pg(
    b,
    "DB — Save Predictions",
    "SELECT lc_save_predictions($1::jsonb) AS saved",
    [
      `JSON.stringify({ game: ${INPUT}.game, contest: ${CTX}.target_contest, method: $json.body.method, algorithm_version: $json.body.algorithm_version,
        seed: $json.body.seed, history_size: $json.body.history_size, disclaimer: $json.body.disclaimer, predictions: $json.body.predictions })`,
    ],
    {
      notes:
        "Banco revalida as dezenas (trigger) e UNIQUE(game, contest, método, versão, variante) impede duplicata.",
    },
  );
  const jobNew = n.set(b, "Job — Prediction Content", {
    content_type: "PREDICTION",
    game: `={{ ${INPUT}.game }}`,
    prediction_id: "={{ $json.saved.predictions[0].id }}",
    dry_run: [`={{ ${INPUT}.dry_run }}`, "boolean"],
    correlation_id: `={{ ${INPUT}.correlation_id }}`,
  });
  const jobExisting = n.set(b, "Job — Existing Prediction Content", {
    content_type: "PREDICTION",
    game: `={{ ${INPUT}.game }}`,
    prediction_id: "={{ $json.ctx.existing[0].id }}",
    dry_run: [`={{ ${INPUT}.dry_run }}`, "boolean"],
    correlation_id: `={{ ${INPUT}.correlation_id }}`,
  });
  const run = n.execute(b, "Run — Prediction Content", WF.orchestrator);
  const summary = n.code(
    b,
    "Return — Prediction Summary",
    `return { json: { ok: $json.ok === true, outcome: 'PREDICTION_DONE', game: ${INPUT}.game, contest: ${CTX}.target_contest, ...$json } };`,
  );
  b.chain(trigger, validate, load, ok);
  b.connect(ok, exists, { output: 0 }).connect(ok, notOk, { output: 1 });
  b.connect(exists, jobExisting, { output: 0 }).connect(exists, generate, { output: 1 });
  b.connect(generate, genOk)
    .connect(genOk, save, { output: 0 })
    .connect(genOk, genReportSet, { output: 1 })
    .connect(genReport, genFailed);
  b.chain(save, jobNew, run, summary);
  b.connect(jobExisting, run);
  return b.toJSON();
}

// =====================================================================
// WF-05 — Conferência dos palpites
// =====================================================================
export function buildCheck() {
  const NAME = "WF-05-Check-Prediction-Results";
  const INPUT = "$('Validate — Check Input').first().json";
  const CTX = "$('DB — Load Check Context').first().json.ctx";
  const S = `${CTX}.settings`;
  const b = new WorkflowBuilder({
    id: WF.check,
    name: NAME,
    description:
      "Confere deterministicamente os palpites contra o resultado oficial, grava e dispara o conteúdo CHECK.",
    tags: ["loteria-cursos", "predictions"],
  });
  b.sticky(
    "## WF-05 — Conferência\n\nInterseção exata palpite × resultado oficial (engine). **Nenhum LLM conta acertos.**\n\n" +
      "Texto fala em *coincidências* — prêmio só a CAIXA confirma (faixas oficiais).",
    { height: 200 },
  );
  const trigger = n.executeWorkflowTrigger(b, "Trigger — Check Request");
  const validate = n.code(
    b,
    "Validate — Check Input",
    `
const i = $input.item.json;
const uuid = /^[0-9a-f-]{36}$/i;
const hasDraw = uuid.test(String(i.draw_id ?? ''));
if (!hasDraw && !(/^[a-z0-9_]+$/.test(String(i.game ?? '')) && Number.isInteger(Number(i.contest)))) {
  throw new Error('INVALID_CHECK_INPUT: informe draw_id ou game + contest');
}
return { json: { draw_id: hasDraw ? i.draw_id : null, game: i.game ?? null, contest: i.contest ? Number(i.contest) : null,
  dry_run: i.dry_run === true, correlation_id: String(i.correlation_id ?? $execution.id) } };
`,
  );
  const load = n.pg(
    b,
    "DB — Load Check Context",
    "SELECT lc_check_context(COALESCE($1::uuid, (SELECT d.id FROM lottery_draws d JOIN lottery_games g ON g.id = d.game_id WHERE g.slug = $2 AND d.contest = $3::bigint))) AS ctx",
    ["$json.draw_id", "$json.game", "$json.contest"],
  );
  const has = n.ifTrue(
    b,
    "Context — Has Predictions?",
    "$json.ctx.ok === true && ($json.ctx.predictions ?? []).length > 0",
  );
  const none = n.code(
    b,
    "Return — Nothing To Check",
    `return { json: { ok: true, outcome: $json.ctx.ok ? 'NO_PREDICTIONS' : $json.ctx.outcome, checked: 0, message: $json.ctx.message ?? null } };`,
  );
  const check = n.http(b, "Engine — Check Predictions", {
    method: "POST",
    url: `={{ ${S}.engine_url }}/v1/predictions/check`,
    body: js(
      `{ game: ${CTX}.game, result_numbers: ${CTX}.draw.numbers, predictions: ${CTX}.predictions.map((p) => ({ id: p.id, numbers: p.numbers })) }`,
    ),
    timeout: 30000,
  });
  const checkOk = n.ifTrue(b, "Check — OK?", "$json.statusCode === 200 && $json.body?.ok === true");
  const [checkReportSet, checkReport] = reportError(b, "Check Failed", {
    code: "PREDICTION_CHECK_FAILED",
    message:
      "=PREDICTION_CHECK_FAILED: {{ $json.body?.message ?? $json.error?.message ?? 'engine indisponível' }}",
    payload: `{ draw_id: ${CTX}.draw?.id ?? null }`,
    workflowName: NAME,
  });
  const checkFailed = n.code(
    b,
    "Return — Check Failed",
    "return { json: { ok: false, outcome: 'PREDICTION_CHECK_FAILED', checked: 0 } };",
  );
  const save = n.pg(b, "DB — Save Checks", "SELECT lc_save_checks($1::uuid, $2::jsonb) AS saved", [
    `${CTX}.draw.id`,
    "JSON.stringify($json.body.checks)",
  ]);
  const job = n.set(b, "Job — Check Content", {
    content_type: "CHECK",
    game: `={{ ${CTX}.game.slug }}`,
    draw_id: `={{ ${CTX}.draw.id }}`,
    prediction_id: `={{ ${CTX}.predictions[0].id }}`,
    dry_run: [`={{ ${INPUT}.dry_run }}`, "boolean"],
    correlation_id: `={{ ${INPUT}.correlation_id }}`,
  });
  const run = n.execute(b, "Run — Check Content", WF.orchestrator);
  const summary = n.code(
    b,
    "Return — Check Summary",
    `return { json: { ok: $json.ok === true, outcome: 'CHECK_DONE', checked: $('Engine — Check Predictions').item.json.body.checks.length,
  checks: $('Engine — Check Predictions').item.json.body.checks, post: $json } };`,
  );
  b.chain(trigger, validate, load, has);
  b.connect(has, check, { output: 0 }).connect(has, none, { output: 1 });
  b.connect(check, checkOk)
    .connect(checkOk, save, { output: 0 })
    .connect(checkOk, checkReportSet, { output: 1 })
    .connect(checkReport, checkFailed);
  b.chain(save, job, run, summary);
  return b.toJSON();
}
