import { WorkflowBuilder, WF, n, js, reportError } from "./lib.mjs";

const NAME = "WF-01-Sync-Lottery-Results";
const INPUT = "$('Validate — Sync Input').first().json";
const CTX = "$('DB — Load Game Context').first().json.ctx";
const S = `${CTX}.settings`;
const ENGINE = `{{ ${S}.engine_url }}`;
const RUN_ID =
  "($('DB — Claim Poll Run').isExecuted ? ($('DB — Claim Poll Run').first().json.run?.run_id ?? null) : null)";

export function buildSync() {
  const b = new WorkflowBuilder({
    id: WF.sync,
    name: NAME,
    description:
      "Busca o resultado na fonte (via Lottery Core), valida, grava com idempotência e dispara o conteúdo RESULT e a conferência de palpites.",
    tags: ["loteria-cursos", "results"],
  });
  b.sticky(
    "## WF-01 — Resultados\n\n" +
      "Fluxo obrigatório: **Fonte → validação estrutural → dezenas → concurso → persistência → arte → publicação**. A IA nunca toca nos números.\n\n" +
      "- `mode=poll` (agenda): reserva a rodada (`result_poll_runs`, UNIQUE), consulta, e se ainda não saiu o concurso novo espera com backoff " +
      "(`lottery_result_poll_interval_seconds`, máx. `lottery_result_max_attempts`). Sem laço infinito.\n" +
      "- `mode=once` (teste manual): consulta uma vez; resultado já gravado segue para o conteúdo (idempotente).\n" +
      "- `mode=backfill`: completa o histórico para os palpites, com pausa entre chamadas.\n" +
      "- Payload inválido → **não publica**; mesmo concurso com conteúdo diferente → **DATA_CONFLICT**, publicação bloqueada.",
    { height: 380, width: 560 },
  );

  const trigger = n.executeWorkflowTrigger(b, "Trigger — Sync Request");
  const validate = n.code(
    b,
    "Validate — Sync Input",
    `
const i = $input.item.json;
const mode = ['poll', 'once', 'backfill'].includes(i.mode) ? i.mode : 'once';
if (!/^[a-z0-9_]+$/.test(String(i.game ?? ''))) throw new Error('INVALID_SYNC_INPUT: game inválido');
if (mode === 'poll' && Number.isNaN(Date.parse(i.scheduled_draw_at ?? ''))) throw new Error('INVALID_SYNC_INPUT: scheduled_draw_at obrigatório no modo poll');
const contest = i.contest === undefined || i.contest === null ? null : Number(i.contest);
if (contest !== null && (!Number.isInteger(contest) || contest < 1)) throw new Error('INVALID_SYNC_INPUT: contest inválido');
return { json: { game: i.game, mode, scheduled_draw_at: i.scheduled_draw_at ?? null, contest, count: Number(i.count ?? 20),
  dry_run: i.dry_run === true, correlation_id: String(i.correlation_id ?? $execution.id) } };
`,
  );
  const load = n.pg(b, "DB — Load Game Context", "SELECT lc_game_context($1) AS ctx", [
    "$json.game",
  ]);
  const enabled = n.ifTrue(
    b,
    "Game — Enabled?",
    "$json.ctx.ok === true && $json.ctx.outcome === 'OK'",
  );
  const unavailable = n.code(
    b,
    "Return — Game Unavailable",
    `return { json: { ok: false, outcome: $json.ctx.outcome, game: ${INPUT}.game } };`,
  );
  const routeMode = n.switchOn(
    b,
    "Route — Sync Mode",
    `${INPUT}.mode`,
    ["poll", "once", "backfill"],
    { fallback: false },
  );

  // ---------------- polling
  const claimRun = n.pg(
    b,
    "DB — Claim Poll Run",
    "SELECT lc_claim_poll_run($1, $2::timestamptz) AS run",
    [`${INPUT}.game`, `${INPUT}.scheduled_draw_at`],
    {
      notes:
        "UNIQUE(game_id, scheduled_draw_at): duas execuções para o mesmo sorteio → só uma faz o polling.",
    },
  );
  const claimed = n.ifTrue(b, "Poll Run — Claimed?", "$json.run.claimed === true");
  const alreadyPolling = n.code(
    b,
    "Return — Already Polling",
    `return { json: { ok: true, outcome: 'ALREADY_RUNNING_OR_DONE', game: ${INPUT}.game } };`,
  );
  const attempt = n.code(
    b,
    "Poll — Attempt State",
    `
const j = $input.item.json;
const ctx = j.body?.context ?? {};
return { json: { attempt: ctx.loop === 'result_poll' ? Number(ctx.attempt ?? 0) + 1 : 1 } };
`,
  );
  const guard = n.ifTrue(
    b,
    "Guard — Poll Attempts",
    "$json.attempt <= 30",
    "Trava extra contra laço infinito.",
  );
  const guardStop = n.stop(
    b,
    "Stop — Poll Loop Guard",
    `'POLL_LOOP_GUARD: tentativas demais para ' + ${INPUT}.game`,
  );
  const circuit = n.pg(
    b,
    "DB — Circuit Check (Source)",
    "SELECT lc_circuit_allow('lottery_source') AS circuit",
  );
  const circuitOk = n.ifTrue(b, "Circuit — Source Allowed?", "$json.circuit.allowed === true");
  const circuitStop = n.pg(
    b,
    "DB — Finish Run (Circuit Open)",
    "SELECT CASE WHEN $1::uuid IS NULL THEN NULL ELSE lc_finish_poll_run($1::uuid, 'FAILED', $2::int, NULL, 'SOURCE_CIRCUIT_OPEN') END AS run",
    [RUN_ID, "$('Poll — Attempt State').item.json.attempt"],
  );
  const circuitReturn = n.code(
    b,
    "Return — Source Circuit Open",
    `return { json: { ok: false, outcome: 'SOURCE_CIRCUIT_OPEN', game: ${INPUT}.game } };`,
  );
  const fetch = n.http(b, "Engine — Fetch Result", {
    method: "POST",
    url: `=${ENGINE}/v1/results/fetch`,
    body: js(
      `{ game: ${CTX}.game, ...(${INPUT}.mode === 'once' && ${INPUT}.contest ? { contest: ${INPUT}.contest } : {}) }`,
    ),
    timeout: 90000,
    notes:
      "O engine usa o LotterySourceAdapter (CAIXA hoje; trocável) e devolve o resultado JÁ validado e normalizado.",
  });
  const routeSource = n.switchOn(b, "Route — Source Response", "String($json.statusCode ?? 0)", [
    "200",
    "422",
  ]);
  const ingest = n.pg(
    b,
    "DB — Ingest Draw",
    "SELECT lc_ingest_draw($1, $2::jsonb, false) AS ingest, lc_circuit_record('lottery_source', true) AS circuit",
    [`${INPUT}.game`, "JSON.stringify($json.body.draw)"],
    {
      notes:
        "INSERT … ON CONFLICT (game_id, contest). Mesmo concurso + hash diferente = DATA_CONFLICT (não sobrescreve).",
    },
  );
  const classifyIngest = n.code(
    b,
    "Ingest — Classify",
    `
// PROCEED: concurso novo (ou repetição no modo manual) · WAIT: polling e a fonte ainda mostra o concurso antigo.
const ing = $json.ingest;
const mode = ${INPUT}.mode;
const baseline = Number(${CTX}.last_draw?.contest ?? 0);
let route = 'INVALID';
if (ing.outcome === 'CONFLICT') route = 'CONFLICT';
else if (['INSERTED', 'DUPLICATE'].includes(ing.outcome)) route = mode !== 'poll' || Number(ing.contest) > baseline ? 'PROCEED' : 'WAIT';
return { json: { route, ingest: ing } };
`,
  );
  const routeIngest = n.switchOn(b, "Route — Ingest Outcome", "$json.route", [
    "PROCEED",
    "WAIT",
    "CONFLICT",
  ]);
  const sourceFail = n.pg(
    b,
    "DB — Source Unavailable",
    "SELECT lc_circuit_record('lottery_source', false, $1) AS circuit",
    ["String($json.body?.message ?? $json.error?.message ?? ('HTTP ' + ($json.statusCode ?? 0)))"],
  );
  const isPolling = n.ifTrue(b, "Mode — Is Polling?", `${INPUT}.mode === 'poll'`);
  const notNow = n.code(
    b,
    "Return — No New Result",
    `return { json: { ok: false, outcome: $('Engine — Fetch Result').isExecuted && $('Engine — Fetch Result').item.json.statusCode !== 200 ? 'SOURCE_UNAVAILABLE' : 'NO_NEW_RESULT', game: ${INPUT}.game, published: false } };`,
  );
  const decision = n.http(b, "Engine — Poll Decision", {
    method: "POST",
    url: `=${ENGINE}/v1/results/poll-decision`,
    body: js(`{ attempt: $('Poll — Attempt State').item.json.attempt, max_attempts: Number(${S}.lottery_result_max_attempts ?? 10),
      interval_seconds: Number(${S}.lottery_result_poll_interval_seconds ?? 180), context: { loop: 'result_poll', attempt: $('Poll — Attempt State').item.json.attempt } }`),
    timeout: 15000,
  });
  const routeDecision = n.switchOn(b, "Route — Poll Decision", "$json.body?.outcome ?? 'stop'", [
    "retry",
  ]);
  const waitPoll = n.wait(
    b,
    "Wait — Poll Interval",
    "$json.body.delay_seconds",
    "Acima de 65s a execução é salva no banco e retomada depois (sem segurar memória).",
  );
  const exhausted = n.pg(
    b,
    "DB — Finish Run (Exhausted)",
    "SELECT CASE WHEN $1::uuid IS NULL THEN NULL ELSE lc_finish_poll_run($1::uuid, 'EXHAUSTED', $2::int, $3::bigint, 'RESULT_NOT_AVAILABLE') END AS run",
    [RUN_ID, "$('Poll — Attempt State').item.json.attempt", `${CTX}.last_draw?.contest ?? null`],
  );
  const exhaustedReturn = n.code(
    b,
    "Return — Result Not Available",
    `return { json: { ok: false, outcome: 'RESULT_NOT_AVAILABLE', game: ${INPUT}.game, published: false } };`,
  );

  // ---------------- payload inválido / conflito
  const invalid = n.pg(
    b,
    "DB — Record Invalid Payload",
    "SELECT lc_circuit_record('lottery_source', false, $1) AS circuit, CASE WHEN $2::uuid IS NULL THEN NULL ELSE lc_finish_poll_run($2::uuid, 'FAILED', 1, NULL, $1) END AS run",
    [
      "'INVALID_PAYLOAD: ' + ($json.body?.message ?? $json.ingest?.message ?? 'dados inconsistentes')",
      RUN_ID,
    ],
  );
  const [invalidReportSet, invalidReport] = reportError(b, "Invalid Payload", {
    code: "INVALID_LOTTERY_PAYLOAD",
    message:
      "=INVALID_LOTTERY_PAYLOAD {{ " +
      INPUT +
      ".game }}: {{ $('Engine — Fetch Result').item.json.body?.message }} — NADA foi publicado.",
    payload: `{ game: ${INPUT}.game, issues: $('Engine — Fetch Result').item.json.body?.issues ?? [] }`,
    workflowName: NAME,
  });
  const invalidReturn = n.code(
    b,
    "Return — Invalid Payload",
    `return { json: { ok: false, outcome: 'INVALID_PAYLOAD', game: ${INPUT}.game, published: false } };`,
  );
  const conflict = n.pg(
    b,
    "DB — Finish Run (Conflict)",
    "SELECT CASE WHEN $1::uuid IS NULL THEN NULL ELSE lc_finish_poll_run($1::uuid, 'FAILED', 1, $2::bigint, 'DATA_CONFLICT') END AS run",
    [RUN_ID, "$json.ingest.contest"],
  );
  const [conflictReportSet, conflictReport] = reportError(b, "Data Conflict", {
    code: "DATA_CONFLICT",
    message:
      "=DATA_CONFLICT {{ " +
      INPUT +
      ".game }} concurso {{ $('Ingest — Classify').item.json.ingest.contest }}: fonte mudou o resultado já gravado. Publicação BLOQUEADA até análise (tabela data_conflicts).",
    payload: `$('Ingest — Classify').item.json.ingest`,
    workflowName: NAME,
  });
  const conflictReturn = n.code(
    b,
    "Return — Data Conflict",
    `return { json: { ok: false, outcome: 'DATA_CONFLICT', game: ${INPUT}.game, published: false } };`,
  );

  // ---------------- conteúdo RESULT + conferência
  const found = n.pg(
    b,
    "DB — Finish Run (Found)",
    "SELECT CASE WHEN $1::uuid IS NULL THEN NULL ELSE lc_finish_poll_run($1::uuid, 'FOUND', $2::int, $3::bigint) END AS run",
    [RUN_ID, "$('Poll — Attempt State').item.json.attempt", "$json.ingest.contest"],
  );
  const resultJob = n.set(b, "Job — Result Content", {
    content_type: "RESULT",
    game: `={{ ${INPUT}.game }}`,
    draw_id: "={{ $('Ingest — Classify').item.json.ingest.draw_id }}",
    dry_run: [`={{ ${INPUT}.dry_run }}`, "boolean"],
    correlation_id: `={{ ${INPUT}.correlation_id }}`,
  });
  const runContent = n.execute(b, "Run — Result Content", WF.orchestrator);
  const checkJob = n.set(b, "Job — Check Predictions", {
    draw_id: "={{ $('Ingest — Classify').item.json.ingest.draw_id }}",
    dry_run: [`={{ ${INPUT}.dry_run }}`, "boolean"],
    correlation_id: `={{ ${INPUT}.correlation_id }}`,
  });
  const runCheck = n.execute(b, "Run — Check Predictions", WF.check);
  const summary = n.code(
    b,
    "Return — Sync Summary",
    `
const ing = $('Ingest — Classify').item.json.ingest;
const post = $('Run — Result Content').item.json;
return { json: { ok: post.ok === true, outcome: ing.outcome, game: ${INPUT}.game, contest: ing.contest, numbers: ing.draw?.numbers ?? null,
  gap_detected: ing.gap === true, caption: post.caption ?? null, image_url: post.image_url ?? null,
  instagram_publish: post.instagram_publish ?? null, post_status: post.status ?? null, post_id: post.post_id ?? null,
  check: $json } };
`,
  );

  // ---------------- backfill
  const missing = n.pg(
    b,
    "DB — Missing Contests",
    "SELECT contest FROM lc_missing_contests($1, $2::bigint, $3::int)",
    [
      `${INPUT}.game`,
      `${INPUT}.contest ?? ((${CTX}.last_draw?.contest ?? 1) - 1)`,
      `Math.min(${INPUT}.count, Number(${S}.backfill_max_contests ?? 50))`,
    ],
    { alwaysOutputData: true, notes: "Lista só os concursos que ainda não estão no banco." },
  );
  const bfAny = n.ifTrue(
    b,
    "Backfill — Anything Missing?",
    "$json.contest !== undefined && $json.contest !== null",
  );
  const bfLoop = n.loop(b, "Loop — Backfill Contests");
  const bfFetch = n.http(b, "Engine — Fetch Contest", {
    method: "POST",
    url: `=${ENGINE}/v1/results/fetch`,
    body: js(`{ game: ${CTX}.game, contest: Number($json.contest) }`),
    timeout: 90000,
  });
  const bfOk = n.ifTrue(
    b,
    "Backfill — Fetched?",
    "$json.statusCode === 200 && $json.body?.ok === true",
  );
  const bfIngest = n.pg(
    b,
    "DB — Ingest Backfill Draw",
    "SELECT lc_ingest_draw($1, $2::jsonb, true) AS ingest",
    [`${INPUT}.game`, "JSON.stringify($json.body.draw)"],
  );
  const bfWait = n.wait(
    b,
    "Wait — Backfill Throttle",
    "2",
    "Pausa entre consultas para não sobrecarregar a fonte.",
  );
  const bfSummary = n.code(
    b,
    "Return — Backfill Summary",
    `return [{ json: { ok: true, outcome: 'BACKFILL_DONE', game: ${INPUT}.game, processed: $input.all().filter((i) => i.json.contest !== undefined || i.json.ingest || i.json.statusCode).length } }];`,
    { mode: "runOnceForAllItems" },
  );

  // ---------------- ligações
  b.chain(trigger, validate, load, enabled);
  b.connect(enabled, routeMode, { output: 0 }).connect(enabled, unavailable, { output: 1 });
  b.connect(routeMode, claimRun, { output: 0 })
    .connect(routeMode, attempt, { output: 1 })
    .connect(routeMode, missing, { output: 2 });
  b.connect(claimRun, claimed)
    .connect(claimed, attempt, { output: 0 })
    .connect(claimed, alreadyPolling, { output: 1 });
  b.connect(attempt, guard)
    .connect(guard, circuit, { output: 0 })
    .connect(guard, guardStop, { output: 1 });
  b.connect(circuit, circuitOk)
    .connect(circuitOk, fetch, { output: 0 })
    .connect(circuitOk, circuitStop, { output: 1 })
    .connect(circuitStop, circuitReturn);
  b.connect(fetch, routeSource);
  b.connect(routeSource, ingest, { output: 0 })
    .connect(routeSource, invalid, { output: 1 })
    .connect(routeSource, sourceFail, { output: 2 });
  b.chain(invalid, invalidReportSet).connect(invalidReport, invalidReturn);
  b.chain(ingest, classifyIngest, routeIngest);
  b.connect(routeIngest, found, { output: 0 })
    .connect(routeIngest, isPolling, { output: 1 })
    .connect(routeIngest, conflict, { output: 2 });
  b.connect(routeIngest, invalid, { output: 3 });
  b.chain(conflict, conflictReportSet).connect(conflictReport, conflictReturn);
  b.connect(sourceFail, isPolling);
  b.connect(isPolling, decision, { output: 0 }).connect(isPolling, notNow, { output: 1 });
  b.connect(decision, routeDecision)
    .connect(routeDecision, waitPoll, { output: 0 })
    .connect(waitPoll, attempt);
  b.connect(routeDecision, exhausted, { output: 1 }).connect(exhausted, exhaustedReturn);
  b.chain(found, resultJob, runContent, checkJob, runCheck, summary);
  b.connect(missing, bfAny)
    .connect(bfAny, bfLoop, { output: 0 })
    .connect(bfAny, bfSummary, { output: 1 });
  b.connect(bfLoop, bfSummary, { output: 0 }).connect(bfLoop, bfFetch, { output: 1 });
  b.connect(bfFetch, bfOk)
    .connect(bfOk, bfIngest, { output: 0 })
    .connect(bfOk, bfWait, { output: 1 })
    .connect(bfIngest, bfWait)
    .connect(bfWait, bfLoop);
  return b.toJSON();
}
