import { WorkflowBuilder, WF, n } from "./lib.mjs";

// =====================================================================
// WF-00 — Saúde do sistema (sem gerar custo: nenhuma chamada paga)
// =====================================================================
export const HEALTH_AGGREGATE_CODE = `
// Junta os testes num relatório único. Nenhuma chamada paga é feita (OpenAI: só GET /models).
const get = (name) => { try { return $(name).first().json; } catch { return {}; } };
const db = get('DB — Health Context');
const s = db.settings ?? {};
const deep = get('Engine — Deep Health').body ?? {};
const oa = get('OpenAI — Check Model');
const meta = get('Meta — Check Account');
const self = get('n8n — Self Health');
const ok = (r) => r.statusCode === 200;
const services = {
  n8n: ok(self) ? 'ok' : 'down',
  database: db.db_time ? 'ok' : 'down',
  engine: deep.services?.engine ?? 'down',
  lottery_source: deep.services?.lottery_source ?? 'down',
  openai: !String(s.openai_model ?? '').trim() ? 'not_configured' : ok(oa) ? 'ok' : 'down',
  renderer: deep.services?.renderer ?? 'down',
  storage: deep.services?.storage ?? 'down',
  meta: !String(s.meta_ig_user_id ?? '').trim() ? 'not_configured' : ok(meta) ? 'ok' : 'down',
};
const values = Object.values(services);
const status = values.every((v) => v === 'ok') ? 'ok' : services.database === 'down' ? 'down' : 'degraded';
return [{ json: { status, services, publish_mode: s.enable_real_instagram_publish === true ? 'REAL' : 'DRY_RUN',
  details: { lottery_source: deep.details?.lottery_source ?? null, storage: deep.details?.storage ?? null,
    meta_http: meta.statusCode ?? null, openai_http: oa.statusCode ?? null }, checked_at: new Date().toISOString() } }];
`;

export function buildHealth() {
  const S = "$('DB — Health Context').first().json.settings";
  const b = new WorkflowBuilder({
    id: WF.health,
    name: "WF-00-System-Health",
    description:
      "Verifica n8n, PostgreSQL, fonte de loterias, OpenAI, renderer, storage e Meta — sem chamadas pagas.",
    tags: ["loteria-cursos", "ops"],
  });
  b.sticky(
    "## WF-00 — Saúde do sistema\n\nSaída: `{ status, services: { n8n, database, engine, lottery_source, openai, renderer, storage, meta } }`.\n\n" +
      "Custo zero: OpenAI só `GET /models/{modelo}`; Meta só `GET /me`; fonte de loteria com cache de 5 min no engine.\n\n" +
      "Webhook: `GET /webhook/loteria-cursos/health` (com header de autenticação).",
    { height: 240 },
  );
  const schedule = n.scheduleCron(b, "Schedule — Every 6 Hours", "7 */6 * * *");
  const hook = n.webhook(b, "Webhook — Health Check", {
    path: "loteria-cursos/health",
    method: "GET",
  });
  const sub = n.executeWorkflowTrigger(b, "Trigger — Health Request");
  const ctx = n.pg(
    b,
    "DB — Health Context",
    "SELECT lc_settings() AS settings, now() AS db_time",
    [],
    { onError: "continueRegularOutput", retryOnFail: false },
  );
  const deep = n.http(b, "Engine — Deep Health", {
    url: `={{ ${S}?.engine_url ?? 'http://engine:3001' }}/v1/health/deep`,
    timeout: 30000,
  });
  const oa = n.http(b, "OpenAI — Check Model", {
    url: `={{ ${S}?.openai_base_url ?? 'https://api.openai.com/v1' }}/models/{{ encodeURIComponent(${S}?.openai_model || 'not-configured') }}`,
    credential: "openai",
    timeout: 15000,
  });
  const meta = n.http(b, "Meta — Check Account", {
    url: `={{ ${S}?.meta_graph_host }}/{{ ${S}?.meta_graph_api_version }}/me`,
    query: { fields: "user_id,username" },
    credential: "meta",
    timeout: 15000,
  });
  const self = n.http(b, "n8n — Self Health", {
    url: `={{ ${S}?.n8n_health_url ?? 'http://127.0.0.1:5678/healthz' }}`,
    timeout: 10000,
  });
  const agg = n.code(b, "Health — Aggregate", HEALTH_AGGREGATE_CODE, {
    mode: "runOnceForAllItems",
  });
  const save = n.pg(
    b,
    "DB — Save Health Check",
    "INSERT INTO health_checks (status, services, details) VALUES ($1, $2::jsonb, $3::jsonb) RETURNING id",
    ["$json.status", "JSON.stringify($json.services)", "JSON.stringify($json.details)"],
    { onError: "continueRegularOutput" },
  );
  const viaHook = n.ifTrue(b, "Started By Webhook?", "$('Webhook — Health Check').isExecuted");
  const respond = n.respond(b, "Respond — Health", {
    body: "={{ JSON.stringify($('Health — Aggregate').first().json) }}",
  });
  const result = n.code(
    b,
    "Return — Health Report",
    "return [{ json: $('Health — Aggregate').first().json }];",
    { mode: "runOnceForAllItems" },
  );
  b.connect(schedule, ctx).connect(hook, ctx).connect(sub, ctx);
  b.chain(ctx, deep, oa, meta, self, agg, save, viaHook);
  b.connect(viaHook, respond, { output: 0 })
    .connect(respond, result)
    .connect(viaHook, result, { output: 1 });
  return b.toJSON();
}

// =====================================================================
// WF-06 — Métricas do Instagram
// =====================================================================
export function buildInsights() {
  const S = "$('DB — Insight Targets').first().json.settings";
  const ITEM = "$('Loop — Posts').item.json";
  const b = new WorkflowBuilder({
    id: WF.insights,
    name: "WF-06-Instagram-Analytics",
    description:
      "Coleta métricas oficiais (Insights) dos posts publicados e grava a série em instagram_insights.",
    tags: ["loteria-cursos", "analytics"],
  });
  b.sticky(
    "## WF-06 — Métricas\n\nMétricas por tipo de mídia vêm de `system_settings.instagram_insight_metrics` (a Meta muda métricas com frequência — " +
      "ex.: `impressions`/`plays` foram substituídas por `views` em 2025). Métrica recusada pela Meta vira erro registrado, sem derrubar o fluxo.\n\n" +
      "Compare RESULT × PREDICTION × CHECK na view `v_content_performance_summary`.",
    { height: 240 },
  );
  const schedule = n.scheduleCron(b, "Schedule — Daily 09:12", "12 9 * * *");
  const manual = n.manualTrigger(b, "Manual — Run Now");
  const sub = n.executeWorkflowTrigger(
    b,
    "Trigger — Insights Request",
    "Chamado pela ação manual 'insights' do WF-07.",
  );
  const targets = n.pg(
    b,
    "DB — Insight Targets",
    "SELECT t.*, s.settings FROM (SELECT lc_settings() AS settings) s,\n  lc_insight_targets(COALESCE((s.settings->>'insights_lookback_days')::int, 30), COALESCE((s.settings->>'insights_min_interval_hours')::int, 20), 50) t",
    [],
    { alwaysOutputData: true },
  );
  const anyTarget = n.ifTrue(b, "Targets — Any?", "Boolean($json.post_id)");
  const loop = n.loop(b, "Loop — Posts");
  const fetch = n.http(b, "Meta — Get Media Insights", {
    url: `={{ ${S}.meta_graph_host }}/{{ ${S}.meta_graph_api_version }}/{{ $json.instagram_media_id }}/insights`,
    query: {
      metric: `={{ ((${S}.instagram_insight_metrics ?? {})[$json.media_type] ?? ['views', 'reach']).join(',') }}`,
    },
    credential: "meta",
    timeout: 30000,
  });
  const save = n.pg(
    b,
    "DB — Save Insights",
    "SELECT lc_save_insight(jsonb_build_object('post_id', $1::uuid, 'instagram_media_id', $2::text, 'http_status', $3::int,\n  'metrics', lc_flatten_insights($4::jsonb), 'error', $5::text)) AS saved",
    [
      `${ITEM}.post_id`,
      `${ITEM}.instagram_media_id`,
      "$json.statusCode ?? null",
      "JSON.stringify($json.body?.data ?? [])",
      "$json.statusCode === 200 ? null : String($json.body?.error?.message ?? $json.error?.message ?? 'falha ao coletar métricas').slice(0, 500)",
    ],
    { onError: "continueRegularOutput" },
  );
  const wait = n.wait(
    b,
    "Wait — Insights Throttle",
    "2",
    "Ritmo controlado para respeitar limites da Graph API.",
  );
  const done = n.code(
    b,
    "Return — Insights Summary",
    "return [{ json: { ok: true, processed: $input.all().filter((i) => i.json.saved || i.json.post_id).length } }];",
    { mode: "runOnceForAllItems" },
  );
  b.connect(schedule, targets).connect(manual, targets).connect(sub, targets);
  b.connect(targets, anyTarget)
    .connect(anyTarget, loop, { output: 0 })
    .connect(anyTarget, done, { output: 1 });
  b.connect(loop, done, { output: 0 }).connect(loop, fetch, { output: 1 });
  b.chain(fetch, save, wait).connect(wait, loop);
  return b.toJSON();
}
