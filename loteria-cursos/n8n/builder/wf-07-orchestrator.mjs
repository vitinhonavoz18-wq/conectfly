import { WorkflowBuilder, WF, n, js, reportError } from "./lib.mjs";

const NAME = "WF-07-Content-Orchestrator";
const JOB = "$('Validate — Content Job').first().json";
const CTX = "$('DB — Load Content Context').first().json.ctx";
const S = `${CTX}.settings`;

export function buildOrchestrator() {
  const b = new WorkflowBuilder({
    id: WF.orchestrator,
    name: NAME,
    description:
      "Orquestrador central: agenda (resultado/palpite/recuperação), teste manual por webhook e o trabalho de conteúdo (plano → post → arte → publicação).",
    tags: ["loteria-cursos", "orchestrator"],
  });
  b.sticky(
    "## WF-07 — Orquestrador de conteúdo\n\n" +
      "**1. Agenda (a cada 10 min)** — pergunta ao banco o que está vencido (`lc_due_jobs`): buscar resultado, gerar palpite, " +
      "recuperar resultado sem post ou palpite não conferido. Cada trabalho roda em execução separada (uma modalidade não trava a outra).\n\n" +
      "**2. Teste manual** — `POST /webhook/loteria-cursos/run` com header de autenticação:\n" +
      '`{ "game": "megasena", "action": "result", "dry_run": true }`\n' +
      "Ações: result · poll · prediction · check · backfill · requeue · health · insights · test_error. `dry_run` é **true por padrão**.\n\n" +
      "**3. Trabalho de conteúdo** (chamado por WF-01/02/05) — plano determinístico no engine → post idempotente → WF-03 → WF-04.",
    { height: 400, width: 560 },
  );

  // ===================== 1) agenda
  const schedule = n.scheduleCron(
    b,
    "Schedule — Every 10 Minutes",
    "*/10 * * * *",
    "Horários dos sorteios ficam em lottery_games (banco), não aqui.",
  );
  const recover = n.pg(
    b,
    "DB — Recover Stuck Posts",
    "SELECT lc_recover_stuck_posts(30) AS recovered",
    [],
    {
      notes:
        "Post preso em RENDERING/PUBLISHING há 30+ min vai para FAILED com motivo. PUBLISHING preso nunca é republicado sozinho.",
    },
  );
  const due = n.pg(
    b,
    "DB — Find Due Jobs",
    "SELECT job_type, game_slug, scheduled_draw_at, contest, draw_id, reason FROM lc_due_jobs(now())",
  );
  const loop = n.loop(b, "Loop — Due Jobs");
  const routeJob = n.switchOn(b, "Route — Job Type", "$json.job_type", [
    "RESULT_POLL",
    "PREDICTION",
    "RESULT_CONTENT",
    "CHECK",
  ]);
  const pollInput = n.set(b, "Job — Poll Input", {
    game: "={{ $json.game_slug }}",
    mode: "poll",
    scheduled_draw_at: "={{ $json.scheduled_draw_at }}",
    dry_run: false,
    correlation_id: "={{ $execution.id }}",
  });
  const runPoll = n.execute(b, "Run — Sync Results (background)", WF.sync, {
    wait: false,
    notes: "Execução separada: o polling pode levar até ~40 min.",
  });
  const predInput = n.set(b, "Job — Prediction Input", {
    game: "={{ $json.game_slug }}",
    contest: ["={{ Number($json.contest) }}", "number"],
    dry_run: false,
    correlation_id: "={{ $execution.id }}",
  });
  const runPred = n.execute(b, "Run — Generate Prediction (background)", WF.predict, {
    wait: false,
  });
  const recoverInput = n.set(b, "Job — Recover Result Content", {
    content_type: "RESULT",
    game: "={{ $json.game_slug }}",
    draw_id: "={{ $json.draw_id }}",
    dry_run: false,
    correlation_id: "={{ $execution.id }}",
  });
  const runRecover = n.execute(b, "Run — Result Content (background)", WF.orchestrator, {
    wait: false,
  });
  const checkInput = n.set(b, "Job — Check Input", {
    draw_id: "={{ $json.draw_id }}",
    dry_run: false,
    correlation_id: "={{ $execution.id }}",
  });
  const runCheck = n.execute(b, "Run — Check Predictions (background)", WF.check, { wait: false });
  const dispatched = n.noop(b, "Done — Jobs Dispatched");

  b.chain(schedule, recover, due, loop);
  b.connect(loop, dispatched, { output: 0 }).connect(loop, routeJob, { output: 1 });
  b.connect(routeJob, pollInput, { output: 0 }).connect(pollInput, runPoll).connect(runPoll, loop);
  b.connect(routeJob, predInput, { output: 1 }).connect(predInput, runPred).connect(runPred, loop);
  b.connect(routeJob, recoverInput, { output: 2 })
    .connect(recoverInput, runRecover)
    .connect(runRecover, loop);
  b.connect(routeJob, checkInput, { output: 3 })
    .connect(checkInput, runCheck)
    .connect(runCheck, loop);
  b.connect(routeJob, loop, { output: 4 });

  // ===================== 2) teste manual
  const hook = n.webhook(b, "Webhook — Manual Run", {
    path: "loteria-cursos/run",
    notes:
      "Protegido por Header Auth (credencial 'Webhook — Loteria Cursos'). dry_run=true por padrão.",
  });
  const validateManual = n.code(
    b,
    "Validate — Manual Request",
    `
const body = $input.item.json.body ?? {};
const actions = ['result', 'poll', 'prediction', 'check', 'backfill', 'requeue', 'health', 'insights', 'test_error'];
const errors = [];
const action = String(body.action ?? '').toLowerCase();
if (!actions.includes(action)) errors.push('action deve ser uma de: ' + actions.join(', '));
const game = body.game === undefined ? null : String(body.game);
if (['result', 'poll', 'prediction', 'check', 'backfill'].includes(action) && !/^[a-z0-9_]+$/.test(game ?? '')) errors.push('game obrigatório (ex.: megasena)');
const contest = body.contest === undefined || body.contest === null ? null : Number(body.contest);
if (contest !== null && (!Number.isInteger(contest) || contest < 1)) errors.push('contest deve ser inteiro positivo');
if (action === 'requeue' && !/^[0-9a-f-]{36}$/i.test(String(body.post_id ?? ''))) errors.push('post_id obrigatório para requeue');
// Segurança: sem "dry_run": false explícito, é simulação.
const dry_run = body.dry_run !== false;
return { json: { valid: errors.length === 0, errors, action, game, contest, dry_run, post_id: body.post_id ?? null,
  count: Math.min(Number(body.count ?? 20) || 20, 200), mode: { backfill: 'backfill', poll: 'poll' }[action] ?? 'once',
  scheduled_draw_at: action === 'poll' ? String(body.scheduled_draw_at ?? new Date().toISOString()) : null, correlation_id: $execution.id } };
`,
  );
  const routeManual = n.switchOn(
    b,
    "Route — Manual Action",
    "$json.valid ? $json.action : 'invalid'",
    [
      "result",
      "poll",
      "prediction",
      "check",
      "backfill",
      "requeue",
      "health",
      "insights",
      "test_error",
    ],
  );
  const runResult = n.execute(b, "Run — Sync Results (manual)", WF.sync);
  const runPollManual = n.execute(b, "Run — Poll Results (manual)", WF.sync, {
    notes: "Força a rotina de polling agora (útil se o resultado atrasar).",
  });
  const runInsights = n.execute(b, "Run — Insights (manual)", WF.insights);
  const runPredManual = n.execute(b, "Run — Prediction (manual)", WF.predict);
  const runCheckManual = n.execute(b, "Run — Check (manual)", WF.check);
  const runBackfill = n.execute(b, "Run — Backfill (manual)", WF.sync);
  const requeue = n.pg(b, "DB — Requeue Post", "SELECT lc_requeue_post($1::uuid) AS result", [
    "$json.post_id",
  ]);
  const runHealth = n.execute(b, "Run — Health (manual)", WF.health);
  const respond = n.respond(b, "Respond — Manual Result");
  const respondBad = n.respond(b, "Respond — Invalid Request", {
    body: js("{ ok: false, errors: $json.errors }"),
    code: 400,
  });
  const testError = n.stop(
    b,
    "Stop — Error Handler Test",
    "'ERROR_HANDLER_TEST: falha proposital para testar o WF-99 (alerta e registro)'",
  );

  b.chain(hook, validateManual, routeManual);
  [
    runResult,
    runPollManual,
    runPredManual,
    runCheckManual,
    runBackfill,
    requeue,
    runHealth,
    runInsights,
  ].forEach((target, i) => {
    b.connect(routeManual, target, { output: i }).connect(target, respond);
  });
  b.connect(routeManual, testError, { output: 8 });
  b.connect(routeManual, respondBad, { output: 9 });

  // ===================== 3) trabalho de conteúdo (sub-workflow)
  const jobTrigger = n.executeWorkflowTrigger(
    b,
    "Trigger — Content Job",
    "Chamado por WF-01 (RESULT), WF-02 (PREDICTION), WF-05 (CHECK).",
  );
  const validateJob = n.code(
    b,
    "Validate — Content Job",
    `
const i = $input.item.json;
const types = ['RESULT', 'PREDICTION', 'CHECK', 'EDUCATIONAL'];
const uuid = (v) => v === undefined || v === null || /^[0-9a-f-]{36}$/i.test(String(v));
if (!types.includes(i.content_type)) throw new Error('INVALID_CONTENT_JOB: content_type inválido: ' + i.content_type);
if (!/^[a-z0-9_]+$/.test(String(i.game ?? ''))) throw new Error('INVALID_CONTENT_JOB: game inválido');
if (!uuid(i.draw_id) || !uuid(i.prediction_id)) throw new Error('INVALID_CONTENT_JOB: id inválido');
return { json: { content_type: i.content_type, game: i.game, draw_id: i.draw_id ?? null, prediction_id: i.prediction_id ?? null,
  contest: i.contest ?? null, format: i.format === 'story' ? 'story' : 'feed', dry_run: i.dry_run === true,
  correlation_id: String(i.correlation_id ?? $execution.id) } };
`,
  );
  const loadCtx = n.pg(
    b,
    "DB — Load Content Context",
    "SELECT lc_content_context($1::jsonb) AS ctx",
    ["JSON.stringify($json)"],
  );
  const ctxOk = n.ifTrue(b, "Context — OK?", "$json.ctx.ok === true");
  const skipped = n.code(
    b,
    "Return — Content Skipped",
    `return { json: { ok: false, content_type: ${JOB}.content_type, game: ${JOB}.game, outcome: $json.ctx?.outcome ?? 'UNKNOWN', message: $json.ctx?.message ?? null } };`,
  );
  const plan = n.http(b, "Engine — Plan Content", {
    method: "POST",
    url: `={{ ${S}.engine_url }}/v1/content/plan`,
    body: js(`{ content_type: ${JOB}.content_type, format: ${JOB}.format,
      dry_run: ${JOB}.dry_run === true || ${S}.enable_real_instagram_publish !== true,
      brand_name: ${S}.brand_name, default_cta: ${S}.default_cta, openai_model: ${S}.openai_model ?? '',
      game: ${CTX}.game, draw: ${CTX}.draw, prediction: ${CTX}.prediction }`),
    timeout: 30000,
    notes:
      "Plano 100% determinístico: chave de idempotência, caminho no Storage, dados da arte, pedido de legenda e legenda de reserva.",
  });
  const planOk = n.ifTrue(
    b,
    "Plan — Valid?",
    "$json.statusCode === 200 && $json.body?.ok === true",
  );
  const [planReportSet, planReport] = reportError(b, "Plan Failed", {
    code: "INVALID_CONTENT",
    message:
      "=INVALID_CONTENT {{ " +
      JOB +
      ".content_type }} {{ " +
      JOB +
      ".game }}: {{ $json.body?.message ?? $json.error?.message ?? 'engine indisponível' }}",
    payload: `{ job: ${JOB}, issues: $json.body?.issues ?? null }`,
    workflowName: NAME,
  });
  const planFailed = n.code(
    b,
    "Return — Plan Failed",
    `return { json: { ok: false, outcome: 'INVALID_CONTENT', content_type: ${JOB}.content_type, game: ${JOB}.game } };`,
  );
  const upsert = n.pg(
    b,
    "DB — Upsert Social Post",
    "SELECT lc_upsert_post($1::jsonb, $2) AS upsert",
    ["JSON.stringify($json.body.plan)", `${JOB}.correlation_id`],
    {
      notes: "INSERT … ON CONFLICT (idempotency_key): rodar duas vezes devolve o MESMO post.",
    },
  );
  const routePost = n.switchOn(
    b,
    "Route — Post Status",
    "$json.upsert.ok ? $json.upsert.post.status : $json.upsert.outcome",
    ["DRAFT", "READY", "RENDERED"],
  );
  const renderInput = n.set(b, "Job — Render Input", {
    post_id: "={{ $('DB — Upsert Social Post').first().json.upsert.post.id }}",
    correlation_id: `={{ ${JOB}.correlation_id }}`,
  });
  const runRender = n.execute(b, "Run — Render Social Post", WF.render);
  const rendered = n.ifTrue(b, "Render — Succeeded?", "$json.status === 'RENDERED'");
  const publishInput = n.set(b, "Job — Publish Input", {
    post_id: "={{ $('DB — Upsert Social Post').first().json.upsert.post.id }}",
    dry_run: [`={{ ${JOB}.dry_run === true }}`, "boolean"],
    correlation_id: `={{ ${JOB}.correlation_id }}`,
  });
  const runPublish = n.execute(b, "Run — Publish Instagram", WF.publish);
  const finalPost = n.pg(b, "DB — Load Final Post", "SELECT lc_get_post($1::uuid) AS ctx", [
    "$('DB — Upsert Social Post').first().json.upsert.post?.id ?? null",
  ]);
  const summary = n.code(
    b,
    "Return — Content Summary",
    `
// Resumo do post (é isto que o teste manual devolve).
const p = $json.ctx?.post ?? {};
const up = $('DB — Upsert Social Post').first().json.upsert;
const d = p.content_data ?? {};
const label = { PUBLISHED: 'PUBLISHED', PUBLISHED_SIMULATED: 'SKIPPED_DRY_RUN' }[p.status] ?? p.status ?? up.outcome;
return { json: { ok: ['PUBLISHED', 'PUBLISHED_SIMULATED'].includes(p.status), content_type: p.type ?? ${JOB}.content_type,
  game: p.game ?? ${JOB}.game, contest: p.contest ?? null, numbers: d.content_type === 'PREDICTION' ? d.prediction_numbers : d.numbers,
  hits: d.hits ?? null, caption: p.caption ?? null, caption_source: p.caption_source ?? null, image_url: p.media_url ?? null,
  instagram_publish: label, instagram_media_id: p.instagram_media_id ?? null, status: p.status ?? up.outcome, post_id: p.id ?? null,
  idempotency_key: p.idempotency_key ?? null, created_now: up.inserted === true, last_error: p.last_error ?? null } };
`,
  );

  b.chain(jobTrigger, validateJob, loadCtx, ctxOk);
  b.connect(ctxOk, plan, { output: 0 }).connect(ctxOk, skipped, { output: 1 });
  b.connect(plan, planOk)
    .connect(planOk, upsert, { output: 0 })
    .connect(planOk, planReportSet, { output: 1 })
    .connect(planReport, planFailed);
  b.connect(upsert, routePost);
  b.connect(routePost, renderInput, { output: 0 })
    .connect(routePost, renderInput, { output: 1 })
    .connect(routePost, publishInput, { output: 2 });
  b.connect(routePost, finalPost, { output: 3 });
  b.chain(renderInput, runRender, rendered);
  b.connect(rendered, publishInput, { output: 0 }).connect(rendered, finalPost, { output: 1 });
  b.chain(publishInput, runPublish, finalPost, summary);
  return b.toJSON();
}
