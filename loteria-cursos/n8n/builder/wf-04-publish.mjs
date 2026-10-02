import { WorkflowBuilder, WF, n, js, reportError } from "./lib.mjs";

const NAME = "WF-04-Publish-Instagram";
// Nodes que rodam UMA vez por execução: referência segura com .first().
const INPUT = "$('Validate — Publish Input').first().json";
const CLAIM = "$('DB — Claim Post For Publish').first().json";
const S = `${CLAIM}.settings`;
const POST = `${CLAIM}.claim.post`;
const GRAPH = `{{ ${S}.meta_graph_host }}/{{ ${S}.meta_graph_api_version }}`;
const ENGINE = `{{ ${S}.engine_url }}`;

/** Corpo comum das chamadas de classificação da resposta da Meta (decisão no engine, testada). */
const classifyBody = (operation, attemptNode, maxKey, loop) =>
  js(`{ operation: '${operation}', status_code: $json.statusCode ?? null, body: $json.body ?? null, headers: $json.headers ?? null,
    error: $json.error ? String($json.error.message ?? $json.error) : null,
    attempt: $('${attemptNode}').item.json.attempt, max_attempts: Number(${S}.${maxKey} ?? 4),
    context: { loop: '${loop}', attempt: $('${attemptNode}').item.json.attempt } }`);

// Contador de tentativas de UM laço: só continua a contagem se o item veio do próprio laço
// (context.loop); vindo de outra etapa, recomeça em 1.
const attemptCode = (loop) => `
const j = $input.item.json;
const ctx = j.classification?.context ?? {};
return { json: { attempt: ctx.loop === '${loop}' ? Number(ctx.attempt ?? 0) + 1 : 1 } };
`;

// O log grava a tentativa E devolve a decisão adiante ("classification"): fluxo linear,
// sem ramos laterais (em sub-workflow o n8n devolve a saída do ÚLTIMO node executado).
const CLS =
  "($json.body?.outcome ? $json.body : { outcome: 'engine_error', error_code: 'ENGINE_UNAVAILABLE', error_message: String($json.error?.message ?? ('engine HTTP ' + ($json.statusCode ?? 0))), attempt: 1, context: {} })";
const logAttemptSql = "SELECT lc_record_attempt($1::jsonb) AS result, $2::jsonb AS classification";
const logAttemptParams = (operation) => [
  `JSON.stringify({ post_id: ${INPUT}.post_id, operation: '${operation}', attempt: ${CLS}.attempt ?? 1, http_status: ${CLS}.http_status ?? null,
    outcome: ['success', 'retry', 'fail', 'wait', 'ready', 'already_published'].includes(${CLS}.outcome) ? ${CLS}.outcome : 'fail',
    error_code: ${CLS}.error_code ?? null, error_message: ${CLS}.error_message ?? null,
    response: { graph_error: ${CLS}.graph_error ?? null, data: ${CLS}.data ?? null }, correlation_id: ${INPUT}.correlation_id })`,
  `JSON.stringify(${CLS})`,
];

export function buildPublisher() {
  const b = new WorkflowBuilder({
    id: WF.publish,
    name: NAME,
    description:
      "Sub-workflow reutilizável que publica um post no Instagram (API oficial) com idempotência, dry-run, retry com backoff e circuit breaker.",
    tags: ["loteria-cursos", "instagram"],
  });
  b.sticky(
    "## WF-04 — Publicador do Instagram (API oficial)\n\n" +
      "**Entrada:** `{ post_id, dry_run?, media_type?, media_url?, caption?, idempotency_key? }` — o banco é a fonte da verdade.\n\n" +
      "1. *Claim* atômico RENDERED→PUBLISHING (duas execuções simultâneas: só uma passa).\n" +
      "2. **DRY RUN**: se `enable_real_instagram_publish` ≠ true, nada vai à Meta → `PUBLISHED_SIMULATED`.\n" +
      "3. Circuit breaker da Meta, intervalo mínimo entre posts.\n" +
      "4. Container → status (IN_PROGRESS/FINISHED/ERROR/EXPIRED/PUBLISHED) → `media_publish`.\n" +
      "5. 429/5xx/rede: backoff com jitter (decisão do engine). Token inválido/permissão: falha na hora, sem repetir.\n" +
      "Container que nunca chega a FINISHED → FAILED **sem** media_publish.",
    { height: 360, width: 520 },
  );

  const trigger = n.executeWorkflowTrigger(b, "Trigger — Publish Request");
  const validate = n.code(
    b,
    "Validate — Publish Input",
    `
const i = $input.item.json;
if (!/^[0-9a-f-]{36}$/i.test(String(i.post_id ?? ''))) throw new Error('INVALID_PUBLISH_INPUT: post_id ausente ou inválido');
if (i.media_type !== undefined && !['IMAGE', 'STORIES', 'REELS'].includes(i.media_type)) throw new Error('INVALID_PUBLISH_INPUT: media_type não suportado');
if (i.media_url !== undefined && !/^https?:\\/\\//.test(String(i.media_url))) throw new Error('INVALID_PUBLISH_INPUT: media_url deve ser http(s)');
return { json: { post_id: i.post_id, force_dry_run: i.dry_run === true, expected_key: i.idempotency_key ?? null,
  correlation_id: String(i.correlation_id ?? $execution.id) } };
`,
  );
  const claim = n.pg(
    b,
    "DB — Claim Post For Publish",
    "SELECT lc_transition_post($1::uuid, ARRAY['RENDERED'], 'PUBLISHING', '{}'::jsonb) AS claim, lc_settings() AS settings,\n  (SELECT max(published_at) FROM social_posts WHERE status = 'PUBLISHED') AS last_publish_at",
    ["$json.post_id"],
    {
      notes:
        "Compare-and-swap: só muda se o post estiver RENDERED. Post já publicado nunca volta para cá.",
    },
  );
  const claimed = n.ifTrue(
    b,
    "Claim — Acquired?",
    `$json.claim.transitioned === true && (${INPUT}.expected_key === null || ${INPUT}.expected_key === $json.claim.post.idempotency_key)`,
  );
  const already = n.code(
    b,
    "Return — Already Handled",
    `
const c = $('DB — Claim Post For Publish').first().json.claim;
const st = c.post?.status ?? 'NOT_FOUND';
const map = { PUBLISHED: 'ALREADY_PUBLISHED', PUBLISHED_SIMULATED: 'SKIPPED_DRY_RUN', PUBLISHING: 'IN_PROGRESS_ELSEWHERE' };
return { json: { ok: st === 'PUBLISHED' || st === 'PUBLISHED_SIMULATED', post_id: c.post?.id ?? null, status: st,
  instagram_publish: map[st] ?? 'SKIPPED_' + st, instagram_media_id: c.post?.instagram_media_id ?? null, idempotent_stop: true } };
`,
  );
  const gate = n.ifTrue(
    b,
    "Gate — Real Publish Enabled?",
    `${S}.enable_real_instagram_publish === true && ${POST}.dry_run === false && ${INPUT}.force_dry_run !== true`,
    "Publicação real só com ENABLE_REAL_INSTAGRAM_PUBLISH=true E post de produção E sem dry_run na chamada.",
  );
  const simulated = n.pg(
    b,
    "DB — Mark Published Simulated",
    "SELECT lc_transition_post($1::uuid, ARRAY['PUBLISHING'], 'PUBLISHED_SIMULATED', '{}'::jsonb) AS result, lc_record_attempt($2::jsonb) AS attempt",
    [
      `${INPUT}.post_id`,
      `JSON.stringify({ post_id: ${INPUT}.post_id, operation: 'dry_run', attempt: 1, outcome: 'skipped', error_code: 'DRY_RUN', error_message: 'Meta NÃO chamada: publicação real desativada ou post de simulação', correlation_id: ${INPUT}.correlation_id })`,
    ],
  );
  const simulatedReturn = n.code(
    b,
    "Return — Dry Run",
    `
const p = $json.result.post;
return { json: { ok: true, post_id: p.id, status: p.status, instagram_publish: 'SKIPPED_DRY_RUN', media_url: p.media_url, idempotency_key: p.idempotency_key } };
`,
  );

  // --- circuito + throttling
  const circuit = n.pg(
    b,
    "DB — Circuit Check (Meta)",
    "SELECT lc_circuit_allow('meta') AS circuit",
  );
  const circuitOk = n.ifTrue(b, "Circuit — Meta Allowed?", "$json.circuit.allowed === true");
  const release = n.pg(
    b,
    "DB — Release Claim (Circuit Open)",
    "SELECT lc_transition_post($1::uuid, ARRAY['PUBLISHING'], 'RENDERED', jsonb_build_object('last_error', $2::text)) AS result, lc_record_attempt($3::jsonb) AS attempt",
    [
      `${INPUT}.post_id`,
      "'META_CIRCUIT_OPEN: Meta com falhas seguidas; nova tentativa após ' + ($json.circuit.retry_after_seconds ?? '?') + 's'",
      `JSON.stringify({ post_id: ${INPUT}.post_id, operation: 'circuit_open', attempt: 1, outcome: 'skipped', error_code: 'META_CIRCUIT_OPEN', error_message: $json.circuit.last_error ?? null, correlation_id: ${INPUT}.correlation_id })`,
    ],
  );
  const [circuitReportSet, circuitReport] = reportError(b, "Circuit Open", {
    code: "META_CIRCUIT_OPEN",
    message:
      "=Publicação adiada: circuit breaker da Meta aberto (post {{ " + INPUT + ".post_id }}).",
    payload: `{ post_id: ${INPUT}.post_id }`,
    workflowName: NAME,
  });
  const circuitReturn = n.code(
    b,
    "Return — Circuit Open",
    `return { json: { ok: false, post_id: ${INPUT}.post_id, status: 'RENDERED', instagram_publish: 'DEFERRED_CIRCUIT_OPEN' } };`,
  );
  const throttle = n.code(
    b,
    "Throttle — Compute Delay",
    `
// Intervalo mínimo entre publicações reais (não dispara vários posts de uma vez).
const c = ${CLAIM};
const gap = Number(c.settings.min_seconds_between_publishes ?? 60);
const last = c.last_publish_at ? new Date(c.last_publish_at).getTime() : 0;
return { json: { wait_seconds: Math.min(600, Math.max(0, Math.ceil(gap - (Date.now() - last) / 1000))) } };
`,
  );
  const needWait = n.ifTrue(b, "Throttle — Needs Wait?", "$json.wait_seconds > 0");
  const throttleWait = n.wait(b, "Wait — Publish Throttle", "$json.wait_seconds");
  const containerReq = n.http(b, "Engine — Build Container Request", {
    method: "POST",
    url: `=${ENGINE}/v1/meta/container-request`,
    body: js(
      `{ media_type: ${POST}.media_type, media_url: ${POST}.media_url, caption: ${POST}.caption ?? '' }`,
    ),
    timeout: 15000,
  });
  const containerReqOk = n.ifTrue(
    b,
    "Container Request — Valid?",
    "$json.statusCode === 200 && $json.body?.ok === true",
  );

  // --- criar container (laço de retry)
  const createAttempt = n.code(b, "Create — Attempt State", attemptCode("create"));
  const create = n.http(b, "Meta — Create Media Container", {
    method: "POST",
    url: `=${GRAPH}/{{ ${S}.meta_ig_user_id }}/media`,
    body: "={{ JSON.stringify($('Engine — Build Container Request').first().json.body.body) }}",
    credential: "meta",
    timeout: 30000,
    notes: "POST /{ig-user-id}/media — token no header Authorization (credencial), nunca na URL.",
  });
  const classifyCreate = n.http(b, "Engine — Classify Create", {
    method: "POST",
    url: `=${ENGINE}/v1/meta/classify`,
    body: classifyBody("create_container", "Create — Attempt State", "meta_max_attempts", "create"),
    timeout: 15000,
  });
  const logCreate = n.pg(
    b,
    "DB — Log Create Attempt",
    logAttemptSql,
    logAttemptParams("create_container"),
    { onError: "continueRegularOutput" },
  );
  const routeCreate = n.switchOn(
    b,
    "Route — Create Outcome",
    "$json.classification?.outcome ?? 'engine_error'",
    ["success", "retry", "fail"],
  );
  const waitCreate = n.wait(b, "Wait — Create Backoff", "$json.classification.delay_seconds");
  const saveContainer = n.pg(
    b,
    "DB — Save Container Id",
    "SELECT lc_transition_post($1::uuid, ARRAY['PUBLISHING'], 'PUBLISHING', jsonb_build_object('instagram_container_id', $2::text)) AS result",
    [`${INPUT}.post_id`, "$json.classification.data.container_id"],
  );

  // --- status do container (laço de polling)
  const pollAttempt = n.code(b, "Poll — Attempt State", attemptCode("poll"));
  const status = n.http(b, "Meta — Get Container Status", {
    url: `=${GRAPH}/{{ $('DB — Save Container Id').first().json.result.post.instagram_container_id }}`,
    query: { fields: "status_code,status" },
    credential: "meta",
    timeout: 30000,
  });
  const classifyStatus = n.http(b, "Engine — Classify Container Status", {
    method: "POST",
    url: `=${ENGINE}/v1/meta/classify`,
    body: classifyBody(
      "container_status",
      "Poll — Attempt State",
      "meta_container_max_polls",
      "poll",
    ),
    timeout: 15000,
  });
  const logStatus = n.pg(
    b,
    "DB — Log Status Attempt",
    logAttemptSql,
    logAttemptParams("container_status"),
    { onError: "continueRegularOutput" },
  );
  const routeStatus = n.switchOn(
    b,
    "Route — Container Status",
    "$json.classification?.outcome ?? 'engine_error'",
    ["ready", "wait", "retry", "fail"],
    {
      notes:
        "ready=FINISHED · wait=IN_PROGRESS · fail=ERROR/EXPIRED/timeout · outros=engine fora/PUBLISHED inesperado",
    },
  );
  const waitStatus = n.wait(b, "Wait — Container Poll", "$json.classification.delay_seconds");

  // --- publicar (laço de retry)
  const publishAttempt = n.code(b, "Publish — Attempt State", attemptCode("publish"));
  const publish = n.http(b, "Meta — Publish Media", {
    method: "POST",
    url: `=${GRAPH}/{{ ${S}.meta_ig_user_id }}/media_publish`,
    body: js(
      `{ creation_id: $('DB — Save Container Id').first().json.result.post.instagram_container_id }`,
    ),
    credential: "meta",
    timeout: 30000,
    notes:
      "POST /{ig-user-id}/media_publish. Um container só pode ser publicado uma vez (idempotência do lado da Meta).",
  });
  const classifyPublish = n.http(b, "Engine — Classify Publish", {
    method: "POST",
    url: `=${ENGINE}/v1/meta/classify`,
    body: classifyBody("media_publish", "Publish — Attempt State", "meta_max_attempts", "publish"),
    timeout: 15000,
  });
  const logPublish = n.pg(
    b,
    "DB — Log Publish Attempt",
    logAttemptSql,
    logAttemptParams("media_publish"),
    { onError: "continueRegularOutput" },
  );
  const routePublish = n.switchOn(
    b,
    "Route — Publish Outcome",
    "$json.classification?.outcome ?? 'engine_error'",
    ["success", "retry", "fail"],
  );
  const waitPublish = n.wait(b, "Wait — Publish Backoff", "$json.classification.delay_seconds");
  const markPublished = n.pg(
    b,
    "DB — Mark Published",
    "SELECT lc_transition_post($1::uuid, ARRAY['PUBLISHING'], 'PUBLISHED', jsonb_build_object('instagram_media_id', $2::text)) AS result, lc_circuit_record('meta', true) AS circuit",
    [`${INPUT}.post_id`, "$json.classification.data.media_id"],
  );
  const publishedReturn = n.code(
    b,
    "Return — Published",
    `
const p = $json.result.post;
return { json: { ok: true, post_id: p.id, status: p.status, instagram_publish: 'PUBLISHED', instagram_media_id: p.instagram_media_id, published_at: p.published_at } };
`,
  );
  // Falha depois de retry: a publicação anterior pode ter dado certo (ex.: timeout). Confere antes de marcar FAILED.
  const wasRetried = n.ifTrue(
    b,
    "Publish — Was Retried?",
    "Number($json.classification?.attempt ?? 1) > 1",
  );
  const recheck = n.http(b, "Meta — Recheck Container", {
    url: `=${GRAPH}/{{ $('DB — Save Container Id').first().json.result.post.instagram_container_id }}`,
    query: { fields: "status_code" },
    credential: "meta",
    timeout: 30000,
  });
  const recheckPublished = n.ifTrue(
    b,
    "Recheck — Already Published?",
    "$json.statusCode === 200 && $json.body?.status_code === 'PUBLISHED'",
  );
  const markUnconfirmed = n.pg(
    b,
    "DB — Mark Published (Id Unconfirmed)",
    "SELECT lc_transition_post($1::uuid, ARRAY['PUBLISHING'], 'PUBLISHED', jsonb_build_object('last_error', 'MEDIA_ID_UNCONFIRMED: publicado (container PUBLISHED) mas o ID da mídia não retornou')) AS result, lc_circuit_record('meta', true) AS circuit",
    [`${INPUT}.post_id`],
  );

  // --- caminho de falha (único para todas as etapas)
  const describe = n.code(
    b,
    "Fail — Describe Error",
    `
const j = $input.item.json;
const b = j.classification ?? j.body ?? {};
const code = b.error_code ?? (j.statusCode && j.statusCode !== 200 ? 'ENGINE_HTTP_' + j.statusCode : (j.error ? 'ENGINE_UNAVAILABLE' : 'PUBLISH_FAILED'));
const message = b.error_message ?? b.message ?? j.error?.message ?? 'falha na publicação';
return { json: { error_code: code, message: String(message).slice(0, 900), permanent: b.permanent === true, operation: b.operation ?? null } };
`,
  );
  const markFailed = n.pg(
    b,
    "DB — Mark Publish Failed",
    "SELECT lc_transition_post($1::uuid, ARRAY['PUBLISHING'], 'FAILED', jsonb_build_object('last_error', $2::text)) AS result, lc_circuit_record('meta', false, $2::text) AS circuit",
    [`${INPUT}.post_id`, "$json.error_code + ': ' + $json.message"],
  );
  const [failReportSet, failReport] = reportError(b, "Publish Failed", {
    code: "={{ $('Fail — Describe Error').item.json.error_code }}",
    message:
      "=META_PUBLISH_FAILED post {{ " +
      INPUT +
      ".post_id }}: {{ $('Fail — Describe Error').item.json.message }}",
    payload: `{ post_id: ${INPUT}.post_id, operation: $('Fail — Describe Error').item.json.operation, permanent: $('Fail — Describe Error').item.json.permanent }`,
    workflowName: NAME,
  });
  const failReturn = n.code(
    b,
    "Return — Publish Failed",
    `
const d = $('Fail — Describe Error').item.json;
return { json: { ok: false, post_id: ${INPUT}.post_id, status: 'FAILED', instagram_publish: 'FAILED', error_code: d.error_code, message: d.message } };
`,
  );

  // --- ligações
  b.chain(trigger, validate, claim, claimed);
  b.connect(claimed, gate, { output: 0 }).connect(claimed, already, { output: 1 });
  b.connect(gate, circuit, { output: 0 })
    .connect(gate, simulated, { output: 1 })
    .connect(simulated, simulatedReturn);
  b.connect(circuit, circuitOk)
    .connect(circuitOk, throttle, { output: 0 })
    .connect(circuitOk, release, { output: 1 });
  b.chain(release, circuitReportSet).connect(circuitReport, circuitReturn);
  b.connect(throttle, needWait)
    .connect(needWait, throttleWait, { output: 0 })
    .connect(needWait, containerReq, { output: 1 })
    .connect(throttleWait, containerReq);
  b.connect(containerReq, containerReqOk)
    .connect(containerReqOk, createAttempt, { output: 0 })
    .connect(containerReqOk, describe, { output: 1 });

  b.chain(createAttempt, create, classifyCreate);
  b.chain(classifyCreate, logCreate, routeCreate);
  b.connect(routeCreate, saveContainer, { output: 0 })
    .connect(routeCreate, waitCreate, { output: 1 })
    .connect(waitCreate, createAttempt);
  b.connect(routeCreate, describe, { output: 2 }).connect(routeCreate, describe, { output: 3 });

  b.chain(saveContainer, pollAttempt, status, classifyStatus);
  b.chain(classifyStatus, logStatus, routeStatus);
  b.connect(routeStatus, publishAttempt, { output: 0 });
  b.connect(routeStatus, waitStatus, { output: 1 })
    .connect(routeStatus, waitStatus, { output: 2 })
    .connect(waitStatus, pollAttempt);
  b.connect(routeStatus, describe, { output: 3 }).connect(routeStatus, describe, { output: 4 });

  b.chain(publishAttempt, publish, classifyPublish);
  b.chain(classifyPublish, logPublish, routePublish);
  b.connect(routePublish, markPublished, { output: 0 }).connect(markPublished, publishedReturn);
  b.connect(routePublish, waitPublish, { output: 1 }).connect(waitPublish, publishAttempt);
  b.connect(routePublish, wasRetried, { output: 2 }).connect(routePublish, wasRetried, {
    output: 3,
  });
  b.connect(wasRetried, recheck, { output: 0 }).connect(wasRetried, describe, { output: 1 });
  b.connect(recheck, recheckPublished)
    .connect(recheckPublished, markUnconfirmed, { output: 0 })
    .connect(markUnconfirmed, publishedReturn);
  b.connect(recheckPublished, describe, { output: 1 });

  b.chain(describe, markFailed, failReportSet);
  b.connect(failReport, failReturn);
  return b.toJSON();
}
