import { WorkflowBuilder, WF, n, js, reportError } from "./lib.mjs";

const NAME = "WF-03-Render-Social-Post";
const INPUT = "$('Validate — Render Input').first().json";
const CTX = "$('DB — Load Post').first().json.ctx";
const S = `${CTX}.settings`;
const POST = `${CTX}.post`;
const ENGINE = `{{ ${S}.engine_url }}`;

export function buildRenderer() {
  const b = new WorkflowBuilder({
    id: WF.render,
    name: NAME,
    description:
      "Gera a legenda (OpenAI com Structured Outputs + fallback determinístico) e a arte (renderer + Supabase Storage) de um post.",
    tags: ["loteria-cursos", "content"],
  });
  b.sticky(
    "## WF-03 — Legenda + Arte\n\n" +
      "**Entrada:** `{ post_id }`\n\n" +
      "- **DRAFT → READY**: OpenAI (Responses API, json_schema *strict*). A resposta é validada pelo engine (schema, regras editoriais, integridade). " +
      "Erro transitório → backoff; esgotou/erro permanente → **legenda de reserva determinística**. Os dados oficiais nunca dependem da IA.\n" +
      "- **READY → RENDERING → RENDERED**: renderer gera JPEG 1080×1350 (feed) ou 1080×1920 (story) e grava no Storage.\n" +
      "- Falha na arte → **FAILED**, nada é publicado, erro registrado no WF-99.",
    { height: 330, width: 520 },
  );

  const trigger = n.executeWorkflowTrigger(b, "Trigger — Render Request");
  const validate = n.code(
    b,
    "Validate — Render Input",
    `
const i = $input.item.json;
if (!/^[0-9a-f-]{36}$/i.test(String(i.post_id ?? ''))) throw new Error('INVALID_RENDER_INPUT: post_id ausente ou inválido');
return { json: { post_id: i.post_id, correlation_id: String(i.correlation_id ?? $execution.id) } };
`,
  );
  const load = n.pg(b, "DB — Load Post", "SELECT lc_get_post($1::uuid) AS ctx", ["$json.post_id"]);
  const route = n.switchOn(b, "Route — Post Status", "$json.ctx.post?.status ?? 'NOT_FOUND'", [
    "DRAFT",
    "READY",
    "NOT_FOUND",
  ]);
  const nothing = n.code(
    b,
    "Return — Nothing To Render",
    `
const p = ${POST} ?? {};
return { json: { ok: ['RENDERED', 'PUBLISHED', 'PUBLISHED_SIMULATED'].includes(p.status), post_id: p.id ?? ${INPUT}.post_id, status: p.status ?? 'NOT_FOUND', skipped: true } };
`,
  );

  // ---------------- legenda
  const openaiOn = n.ifTrue(
    b,
    "Gate — OpenAI Configured?",
    `String(${S}.openai_model ?? '').trim() !== ''`,
    "Sem OPENAI_MODEL → legenda de reserva (o post não para).",
  );
  const skipFinalize = n.http(b, "Engine — Fallback Caption", {
    method: "POST",
    url: `=${ENGINE}/v1/content/caption-finalize`,
    body: js(
      `{ content_data: ${POST}.content_data, openai: { skipped: true }, attempt: 1, max_attempts: 1, context: { attempt: 1 } }`,
    ),
    timeout: 15000,
  });
  const attempt = n.code(
    b,
    "Caption — Attempt State",
    `
// Tentativa atual + pedido à OpenAI (modelo vem da configuração, não do código).
const j = $input.item.json;
const ctx = j.finalize?.context ?? {};
const c = $('DB — Load Post').first().json.ctx;
return { json: { attempt: ctx.loop === 'caption' ? Number(ctx.attempt ?? 0) + 1 : 1, request: { ...c.caption_request, model: c.settings.openai_model } } };
`,
  );
  const guard = n.ifTrue(
    b,
    "Guard — Caption Attempts",
    "$json.attempt <= 10",
    "Trava extra contra laço infinito (o engine já limita a openai_max_attempts).",
  );
  const guardStop = n.stop(
    b,
    "Stop — Caption Loop Guard",
    "'CAPTION_LOOP_GUARD: tentativas demais para o post ' + " + INPUT + ".post_id",
  );
  const openai = n.http(b, "OpenAI — Generate Caption", {
    method: "POST",
    url: `={{ ${S}.openai_base_url }}/responses`,
    body: "={{ JSON.stringify($json.request) }}",
    credential: "openai",
    timeout: 60000,
    notes:
      "Responses API + Structured Outputs (text.format json_schema strict). Chave na credencial OpenAI — nunca no JSON.",
  });
  const finalize = n.http(b, "Engine — Finalize Caption", {
    method: "POST",
    url: `=${ENGINE}/v1/content/caption-finalize`,
    body: js(`{ content_data: ${POST}.content_data,
      openai: { status_code: $json.statusCode ?? null, body: $json.body ?? null, headers: $json.headers ?? null, error: $json.error ? String($json.error.message ?? $json.error) : null },
      attempt: $('Caption — Attempt State').item.json.attempt, max_attempts: Number(${S}.openai_max_attempts ?? 3),
      context: { loop: 'caption', attempt: $('Caption — Attempt State').item.json.attempt } }`),
    timeout: 15000,
  });
  // Log + decisão seguem juntos (fluxo linear; ver nota no WF-04).
  const FIN =
    "($json.body?.outcome ? $json.body : { outcome: 'engine_error', reason: String($json.error?.message ?? ('engine HTTP ' + ($json.statusCode ?? 0))), attempt: 1, context: {} })";
  const logCaption = n.pg(
    b,
    "DB — Log Caption Attempt",
    "SELECT lc_record_attempt($1::jsonb) AS result, $2::jsonb AS finalize",
    [
      `JSON.stringify({ post_id: ${INPUT}.post_id, operation: 'caption', attempt: ${FIN}.attempt ?? 1,
        outcome: ['ok', 'fallback', 'retry'].includes(${FIN}.outcome) ? ${FIN}.outcome : 'fail',
        error_code: ${FIN}.outcome === 'ok' ? null : ({ fallback: 'CAPTION_FALLBACK', retry: 'CAPTION_RETRY' }[${FIN}.outcome] ?? 'ENGINE_UNAVAILABLE'),
        error_message: ${FIN}.reason ?? null, correlation_id: ${INPUT}.correlation_id })`,
      `JSON.stringify(${FIN})`,
    ],
  );
  const routeCaption = n.switchOn(
    b,
    "Route — Caption Outcome",
    "$json.finalize?.outcome ?? 'engine_error'",
    ["ok", "fallback", "retry"],
  );
  const waitCaption = n.wait(b, "Wait — Caption Backoff", "$json.finalize.delay_seconds");
  const saveCaption = n.pg(
    b,
    "DB — Save Caption",
    "SELECT lc_transition_post($1::uuid, ARRAY['DRAFT'], 'READY', $2::jsonb) AS result",
    [
      `${INPUT}.post_id`,
      "JSON.stringify({ headline: $json.finalize.headline, caption: $json.finalize.caption, caption_source: $json.finalize.source, hashtags: $json.finalize.hashtags, alt_text: $json.finalize.alt_text })",
    ],
  );
  const captionFail = n.pg(
    b,
    "DB — Mark Caption Failed",
    "SELECT lc_transition_post($1::uuid, ARRAY['DRAFT'], 'FAILED', jsonb_build_object('last_error', 'ENGINE_UNAVAILABLE: não foi possível validar a legenda; reprocessar com requeue')) AS result",
    [`${INPUT}.post_id`],
  );

  // ---------------- arte
  const claimRender = n.pg(
    b,
    "DB — Claim Render",
    "SELECT lc_transition_post($1::uuid, ARRAY['READY'], 'RENDERING', '{}'::jsonb) AS result",
    [`${INPUT}.post_id`],
  );
  const claimed = n.ifTrue(b, "Render Claim — Acquired?", "$json.result.transitioned === true");
  const render = n.http(b, "Renderer — Generate Artwork", {
    method: "POST",
    url: `={{ ${S}.renderer_url }}/render`,
    body: js(
      `{ ...$json.result.post.render_payload, storage_path: $json.result.post.storage_path, store: true, output_format: 'jpeg' }`,
    ),
    timeout: 120000,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
    notes:
      "Template determinístico: nenhum texto crítico da arte vem da IA. Grava no Storage e devolve URL pública.",
  });
  const check = n.code(
    b,
    "Validate — Render Response",
    `
// HTTP 200 não basta: confere formato, dimensão, URL pública e hash.
const r = $input.item.json;
const body = r.body ?? {};
const post = $('DB — Claim Render').first().json.result.post;
const expected = post.format === 'story' ? [1080, 1920] : [1080, 1350];
const problems = [];
if (r.statusCode !== 200) problems.push('HTTP ' + (r.statusCode ?? 'sem resposta') + ' ' + (body.message ?? r.error?.message ?? ''));
if (body.success !== true) problems.push('renderer não confirmou sucesso');
if (body.mime_type !== 'image/jpeg') problems.push('arte não é JPEG (exigência da Meta)');
if (body.width !== expected[0] || body.height !== expected[1]) problems.push('dimensão inesperada');
if (!/^https?:\\/\\//.test(body.public_url ?? '')) problems.push('sem URL pública');
if (!/^[a-f0-9]{64}$/.test(body.sha256 ?? '')) problems.push('hash ausente');
return { json: { ok: problems.length === 0, message: problems.join('; '), media_url: body.public_url ?? null, media_sha256: body.sha256 ?? null,
  media_width: body.width ?? null, media_height: body.height ?? null, storage_path: body.storage_path ?? null } };
`,
  );
  const valid = n.ifTrue(b, "Render — Valid?", "$json.ok === true");
  const saveMedia = n.pg(
    b,
    "DB — Save Media",
    "SELECT lc_transition_post($1::uuid, ARRAY['RENDERING'], 'RENDERED', $2::jsonb) AS result, lc_record_attempt($3::jsonb) AS attempt",
    [
      `${INPUT}.post_id`,
      "JSON.stringify({ media_url: $json.media_url, media_sha256: $json.media_sha256, media_width: $json.media_width, media_height: $json.media_height, storage_path: $json.storage_path })",
      `JSON.stringify({ post_id: ${INPUT}.post_id, operation: 'render', attempt: 1, outcome: 'success', correlation_id: ${INPUT}.correlation_id })`,
    ],
  );
  const rendered = n.code(
    b,
    "Return — Rendered",
    `
const p = $json.result.post;
return { json: { ok: true, post_id: p.id, status: p.status, media_url: p.media_url, caption: p.caption, caption_source: p.caption_source } };
`,
  );
  const renderFail = n.pg(
    b,
    "DB — Mark Render Failed",
    "SELECT lc_transition_post($1::uuid, ARRAY['RENDERING'], 'FAILED', jsonb_build_object('last_error', 'RENDER_FAILED: ' || $2::text)) AS result, lc_record_attempt($3::jsonb) AS attempt",
    [
      `${INPUT}.post_id`,
      "$json.message",
      `JSON.stringify({ post_id: ${INPUT}.post_id, operation: 'render', attempt: 1, outcome: 'fail', error_code: 'RENDER_FAILED', error_message: $json.message, correlation_id: ${INPUT}.correlation_id })`,
    ],
  );
  const [renderReportSet, renderReport] = reportError(b, "Render Failed", {
    code: "RENDER_FAILED",
    message:
      "=RENDER_FAILED post {{ " +
      INPUT +
      ".post_id }}: {{ $('Validate — Render Response').item.json.message }}",
    payload: `{ post_id: ${INPUT}.post_id }`,
    workflowName: NAME,
  });
  const [captionReportSet, captionReport] = reportError(b, "Caption Failed", {
    code: "ENGINE_UNAVAILABLE",
    message: "=ENGINE_UNAVAILABLE ao validar legenda do post {{ " + INPUT + ".post_id }}",
    payload: `{ post_id: ${INPUT}.post_id }`,
    workflowName: NAME,
  });
  const [notFoundSet, notFoundReport] = reportError(b, "Post Not Found", {
    code: "POST_NOT_FOUND",
    message: "=POST_NOT_FOUND {{ " + INPUT + ".post_id }}",
    payload: `{ post_id: ${INPUT}.post_id }`,
    workflowName: NAME,
  });
  const failed = n.code(
    b,
    "Return — Render Failed",
    `return { json: { ok: false, post_id: ${INPUT}.post_id, status: 'FAILED', error_code: $('Render Failed — Error Payload').isExecuted ? 'RENDER_FAILED' : 'CAPTION_OR_POST_ERROR' } };`,
  );

  // ---------------- ligações
  b.chain(trigger, validate, load, route);
  b.connect(route, openaiOn, { output: 0 })
    .connect(route, claimRender, { output: 1 })
    .connect(route, notFoundSet, { output: 2 })
    .connect(route, nothing, { output: 3 });
  b.connect(notFoundReport, failed);
  b.connect(openaiOn, attempt, { output: 0 }).connect(openaiOn, skipFinalize, { output: 1 });
  b.chain(skipFinalize, logCaption);
  b.connect(attempt, guard)
    .connect(guard, openai, { output: 0 })
    .connect(guard, guardStop, { output: 1 });
  b.chain(openai, finalize, logCaption, routeCaption);
  b.connect(routeCaption, saveCaption, { output: 0 }).connect(routeCaption, saveCaption, {
    output: 1,
  });
  b.connect(routeCaption, waitCaption, { output: 2 }).connect(waitCaption, attempt);
  b.connect(routeCaption, captionFail, { output: 3 })
    .connect(captionFail, captionReportSet)
    .connect(captionReport, failed);
  b.connect(saveCaption, claimRender);
  b.connect(claimRender, claimed)
    .connect(claimed, render, { output: 0 })
    .connect(claimed, nothing, { output: 1 });
  b.chain(render, check, valid);
  b.connect(valid, saveMedia, { output: 0 }).connect(saveMedia, rendered);
  b.connect(valid, renderFail, { output: 1 })
    .connect(renderFail, renderReportSet)
    .connect(renderReport, failed);
  return b.toJSON();
}
