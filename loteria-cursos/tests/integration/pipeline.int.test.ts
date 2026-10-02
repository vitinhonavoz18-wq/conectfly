/**
 * Integração dos componentes reais SEM o n8n: PostgreSQL + engine + renderer +
 * simuladores (CAIXA, OpenAI, Meta, Storage), conversando por HTTP de verdade.
 * O "driver" abaixo executa os mesmos passos (e as mesmas funções SQL) que os
 * workflows WF-01/03/04/07 — o E2E repete os cenários dentro do n8n real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ensureMigrated,
  http,
  one,
  pool,
  q,
  resetDb,
  startServices,
  type Services,
} from "./support.ts";

let svc: Services;
beforeAll(async () => {
  await ensureMigrated();
  svc = await startServices();
});
beforeEach(async () => {
  await resetDb();
  await http(`${svc.mockUrl}/__admin/reset`, { method: "POST" });
});
afterAll(async () => {
  await svc.close();
  await pool.end();
});

const mock = (patch: unknown) => http(`${svc.mockUrl}/__admin/scenario`, { body: patch });
const calls = async (service: string) =>
  (await http(`${svc.mockUrl}/__admin/calls?service=${service}`)).body.calls as Array<{
    operation: string;
    status: number;
  }>;
const settings = async () => (await one("SELECT lc_settings() AS s")).s;

// ------------------------------------------------------------------ driver (espelho dos workflows)
async function syncResult(game: string) {
  const ctx = (await one("SELECT lc_game_context($1) AS c", [game])).c;
  const res = await http(`${svc.engineUrl}/v1/results/fetch`, { body: { game: ctx.game } });
  if (res.statusCode !== 200) {
    await q("SELECT lc_circuit_record('lottery_source', false, $1)", [res.body?.message ?? "erro"]);
    if (res.statusCode === 422)
      await q("SELECT lc_log_workflow_error($1::jsonb)", [
        JSON.stringify({
          error_code: "INVALID_LOTTERY_PAYLOAD",
          message: res.body.message,
          workflow_name: "WF-01",
        }),
      ]);
    return { outcome: res.body?.outcome ?? "SOURCE_UNAVAILABLE", status: res.statusCode };
  }
  return (
    await one("SELECT lc_ingest_draw($1, $2::jsonb, false) AS r", [
      game,
      JSON.stringify(res.body.draw),
    ])
  ).r;
}

async function contentJob(contentType: string, game: string, drawId: string, dryRun: boolean) {
  const ctx = (
    await one("SELECT lc_content_context($1::jsonb) AS c", [
      JSON.stringify({ content_type: contentType, game, draw_id: drawId }),
    ])
  ).c;
  const s = ctx.settings;
  const plan = await http(`${svc.engineUrl}/v1/content/plan`, {
    body: {
      content_type: contentType,
      format: "feed",
      dry_run: dryRun || s.enable_real_instagram_publish !== true,
      brand_name: s.brand_name,
      default_cta: s.default_cta,
      openai_model: "gpt-mock",
      game: ctx.game,
      draw: ctx.draw,
      prediction: ctx.prediction,
    },
  });
  const up = (
    await one("SELECT lc_upsert_post($1::jsonb, 'int') AS u", [JSON.stringify(plan.body.plan)])
  ).u;
  if (up.post.status === "DRAFT") await caption(up.post.id);
  const rendered = await render(up.post.id);
  if (rendered === "RENDERED") await publish(up.post.id, dryRun);
  return (await one("SELECT * FROM social_posts WHERE id = $1", [up.post.id])) as Record<
    string,
    any
  >;
}

async function caption(postId: string) {
  const ctx = (await one("SELECT lc_get_post($1) AS c", [postId])).c;
  for (let attempt = 1; attempt <= 10; attempt++) {
    const oa = await http(`${svc.mockUrl}/v1/responses`, {
      body: { ...ctx.caption_request, model: "gpt-mock" },
      headers: { Authorization: "Bearer mock-openai-key" },
    });
    const fin = (
      await http(`${svc.engineUrl}/v1/content/caption-finalize`, {
        body: {
          content_data: ctx.post.content_data,
          openai: { status_code: oa.statusCode, body: oa.body },
          attempt,
          max_attempts: Number(ctx.settings.openai_max_attempts),
        },
      })
    ).body;
    await q("SELECT lc_record_attempt($1::jsonb)", [
      JSON.stringify({ post_id: postId, operation: "caption", attempt, outcome: fin.outcome }),
    ]);
    if (fin.outcome === "retry") continue; // o workflow espera fin.delay_seconds (Wait); aqui não precisa
    await q("SELECT lc_transition_post($1, ARRAY['DRAFT'], 'READY', $2::jsonb)", [
      postId,
      JSON.stringify({
        headline: fin.headline,
        caption: fin.caption,
        caption_source: fin.source,
        hashtags: fin.hashtags,
        alt_text: fin.alt_text,
      }),
    ]);
    return fin;
  }
  throw new Error("laço de legenda sem fim");
}

async function render(postId: string) {
  const claim = (
    await one("SELECT lc_transition_post($1, ARRAY['READY'], 'RENDERING', '{}'::jsonb) AS r", [
      postId,
    ])
  ).r;
  if (!claim.transitioned) return claim.post.status;
  const p = claim.post;
  const res = await http(`${svc.rendererUrl}/render`, {
    body: { ...p.render_payload, storage_path: p.storage_path, store: true },
  });
  const ok =
    res.statusCode === 200 &&
    res.body.success &&
    res.body.mime_type === "image/jpeg" &&
    res.body.width === 1080 &&
    res.body.height === 1350 &&
    /^http/.test(res.body.public_url ?? "");
  if (!ok) {
    const msg = `RENDER_FAILED: HTTP ${res.statusCode} ${res.body?.message ?? ""}`;
    await q(
      "SELECT lc_transition_post($1, ARRAY['RENDERING'], 'FAILED', jsonb_build_object('last_error', $2::text))",
      [postId, msg],
    );
    await q("SELECT lc_log_workflow_error($1::jsonb)", [
      JSON.stringify({ error_code: "RENDER_FAILED", message: msg, workflow_name: "WF-03" }),
    ]);
    return "FAILED";
  }
  await q("SELECT lc_transition_post($1, ARRAY['RENDERING'], 'RENDERED', $2::jsonb)", [
    postId,
    JSON.stringify({
      media_url: res.body.public_url,
      media_sha256: res.body.sha256,
      media_width: 1080,
      media_height: 1350,
    }),
  ]);
  return "RENDERED";
}

async function classify(
  operation: string,
  res: { statusCode: number; body: unknown; headers?: Record<string, unknown> },
  attempt: number,
  max: number,
) {
  return (
    await http(`${svc.engineUrl}/v1/meta/classify`, {
      body: {
        operation,
        status_code: res.statusCode,
        body: res.body,
        headers: res.headers ?? null,
        attempt,
        max_attempts: max,
      },
    })
  ).body;
}

async function fail(postId: string, cls: { error_code: string; error_message: string }) {
  await q(
    "SELECT lc_transition_post($1, ARRAY['PUBLISHING'], 'FAILED', jsonb_build_object('last_error', $2::text)), lc_circuit_record('meta', false, $2::text)",
    [postId, `${cls.error_code}: ${cls.error_message}`],
  );
  await q("SELECT lc_log_workflow_error($1::jsonb)", [
    JSON.stringify({
      error_code: cls.error_code,
      message: cls.error_message,
      workflow_name: "WF-04",
    }),
  ]);
}

async function publish(postId: string, forceDry: boolean) {
  const claim = (
    await one("SELECT lc_transition_post($1, ARRAY['RENDERED'], 'PUBLISHING', '{}'::jsonb) AS r", [
      postId,
    ])
  ).r;
  if (!claim.transitioned) return claim.post.status;
  const s = await settings();
  const post = claim.post;
  if (!(s.enable_real_instagram_publish === true && post.dry_run === false && !forceDry)) {
    await q(
      "SELECT lc_transition_post($1, ARRAY['PUBLISHING'], 'PUBLISHED_SIMULATED', '{}'::jsonb)",
      [postId],
    );
    return "PUBLISHED_SIMULATED";
  }
  const graph = `${svc.mockUrl}/v26.0`;
  const auth = { Authorization: "Bearer mock-meta-token" };
  let cls: any;
  for (let attempt = 1; ; attempt++) {
    const res = await http(`${graph}/1784/media`, {
      body: { image_url: post.media_url, caption: post.caption },
      headers: auth,
    });
    cls = await classify("create_container", res, attempt, 4);
    await q("SELECT lc_record_attempt($1::jsonb)", [
      JSON.stringify({
        post_id: postId,
        operation: "create_container",
        attempt,
        outcome: cls.outcome,
        error_code: cls.error_code,
        http_status: res.statusCode,
      }),
    ]);
    if (cls.outcome !== "retry") break;
  }
  if (cls.outcome !== "success") return fail(postId, cls).then(() => "FAILED");
  const container = cls.data.container_id;
  for (let attempt = 1; ; attempt++) {
    const res = await http(`${graph}/${container}?fields=status_code`, { headers: auth });
    cls = await classify("container_status", res, attempt, Number(s.meta_container_max_polls));
    await q("SELECT lc_record_attempt($1::jsonb)", [
      JSON.stringify({
        post_id: postId,
        operation: "container_status",
        attempt,
        outcome: cls.outcome,
        error_code: cls.error_code,
      }),
    ]);
    if (cls.outcome !== "wait" && cls.outcome !== "retry") break;
  }
  if (cls.outcome !== "ready") return fail(postId, cls).then(() => "FAILED");
  for (let attempt = 1; ; attempt++) {
    const res = await http(`${graph}/1784/media_publish`, {
      body: { creation_id: container },
      headers: auth,
    });
    cls = await classify("media_publish", res, attempt, 4);
    await q("SELECT lc_record_attempt($1::jsonb)", [
      JSON.stringify({
        post_id: postId,
        operation: "media_publish",
        attempt,
        outcome: cls.outcome,
        error_code: cls.error_code,
        http_status: res.statusCode,
      }),
    ]);
    if (cls.outcome !== "retry") break;
    expect(cls.delay_seconds).toBeGreaterThan(0); // backoff (Retry-After) respeitado
  }
  if (cls.outcome !== "success") return fail(postId, cls).then(() => "FAILED");
  await q(
    "SELECT lc_transition_post($1, ARRAY['PUBLISHING'], 'PUBLISHED', jsonb_build_object('instagram_media_id', $2::text)), lc_circuit_record('meta', true)",
    [postId, cls.data.media_id],
  );
  return "PUBLISHED";
}

const enableReal = () =>
  q("UPDATE system_settings SET value='true' WHERE key='enable_real_instagram_publish'");

// ------------------------------------------------------------------ cenários
describe("integração — cenários obrigatórios", () => {
  it("Cenário 1: novo concurso → salvar → post → arte → dry run (1 draw, 1 post, 0 publicação real)", async () => {
    const r = await syncResult("megasena");
    expect(r.outcome).toBe("INSERTED");
    const post = await contentJob("RESULT", "megasena", r.draw_id, false);
    expect(post.status).toBe("PUBLISHED_SIMULATED");
    expect(post.media_url).toMatch(
      /\/storage\/v1\/object\/public\/social-media\/megasena\/results\/megasena-result-3065-feed-dryrun\.jpg$/,
    );
    expect((await q("SELECT 1 FROM lottery_draws")).length).toBe(1);
    expect((await q("SELECT 1 FROM social_posts")).length).toBe(1);
    expect(await calls("meta")).toHaveLength(0);
    // A imagem gravada no Storage é um JPEG válido e acessível publicamente.
    const img = await fetch(post.media_url);
    expect(img.status).toBe(200);
    const buf = Buffer.from(await img.arrayBuffer());
    expect([buf[0], buf[1]]).toEqual([0xff, 0xd8]);
  });

  it("Cenário 2: mesmo concurso duas vezes → 1 draw, 1 post", async () => {
    const a = await syncResult("megasena");
    const p1 = await contentJob("RESULT", "megasena", a.draw_id, false);
    const b = await syncResult("megasena");
    expect(b.outcome).toBe("DUPLICATE");
    const p2 = await contentJob("RESULT", "megasena", b.draw_id, false);
    expect(p2.id).toBe(p1.id);
    expect((await q("SELECT 1 FROM lottery_draws")).length).toBe(1);
    expect((await q("SELECT 1 FROM social_posts")).length).toBe(1);
  });

  it("Cenário 3: payload inválido → FAIL e NO PUBLISH", async () => {
    await mock({ caixa: { mode: "invalid" } });
    const r = await syncResult("megasena");
    expect(r).toMatchObject({ outcome: "INVALID_PAYLOAD", status: 422 });
    expect((await q("SELECT 1 FROM lottery_draws")).length).toBe(0);
    expect((await q("SELECT 1 FROM social_posts")).length).toBe(0);
    expect((await one("SELECT error_code FROM workflow_errors")).error_code).toBe(
      "INVALID_LOTTERY_PAYLOAD",
    );
  });

  it("Cenário 4: OpenAI fora do ar → retry controlado + fallback, sem perda do resultado", async () => {
    await mock({ openai: { mode: "error500" } });
    const r = await syncResult("quina");
    const post = await contentJob("RESULT", "quina", r.draw_id, false);
    expect(post.status).toBe("PUBLISHED_SIMULATED");
    expect(post.caption_source).toBe("fallback");
    expect(post.caption).toContain("RESULTADO QUINA");
    expect(post.caption).toContain("03 · 18 · 41 · 62 · 77");
    const attempts = await q(
      "SELECT outcome FROM publish_attempts WHERE operation='caption' ORDER BY created_at",
    );
    expect(attempts.map((a) => a.outcome)).toEqual(["retry", "retry", "fallback"]);
    expect((await q("SELECT 1 FROM lottery_draws")).length).toBe(1);
  });

  it("Cenário 5: Meta 429 → backoff e retry até publicar", async () => {
    await enableReal();
    await mock({ meta: { publish_mode: "rate_limit", publish_fail_times: 2 } });
    const r = await syncResult("lotofacil");
    const post = await contentJob("RESULT", "lotofacil", r.draw_id, false);
    expect(post.status).toBe("PUBLISHED");
    expect(post.instagram_media_id).toBeTruthy();
    expect(
      (await calls("meta")).filter((c) => c.operation === "media_publish").map((c) => c.status),
    ).toEqual([429, 429, 200]);
  });

  it("Cenário 6: token inválido → não repete, FAILED, erro registrado", async () => {
    await enableReal();
    await mock({ meta: { create_mode: "invalid_token" } });
    const r = await syncResult("lotomania");
    const post = await contentJob("RESULT", "lotomania", r.draw_id, false);
    expect(post.status).toBe("FAILED");
    expect(post.last_error).toMatch(/^TOKEN_INVALID/);
    expect((await calls("meta")).filter((c) => c.operation === "create_container")).toHaveLength(1);
    expect((await one("SELECT error_code FROM workflow_errors")).error_code).toBe("TOKEN_INVALID");
  });

  it("Cenário 7: renderer/storage falha → NO PUBLISH, FAILED, erro registrado", async () => {
    await enableReal();
    await mock({ storage: { mode: "error500" } });
    const r = await syncResult("megasena");
    const post = await contentJob("RESULT", "megasena", r.draw_id, false);
    expect(post.status).toBe("FAILED");
    expect(post.last_error).toContain("RENDER_FAILED");
    expect(await calls("meta")).toHaveLength(0);
    expect((await one("SELECT error_code FROM workflow_errors")).error_code).toBe("RENDER_FAILED");
  });

  it("Cenário 8: container nunca FINISHED → timeout, FAILED, NO media_publish", async () => {
    await enableReal();
    await q("UPDATE system_settings SET value='4' WHERE key='meta_container_max_polls'");
    await mock({ meta: { container_mode: "never" } });
    const r = await syncResult("quina");
    const post = await contentJob("RESULT", "quina", r.draw_id, false);
    await q("UPDATE system_settings SET value='10' WHERE key='meta_container_max_polls'");
    expect(post.status).toBe("FAILED");
    expect(post.last_error).toMatch(/^CONTAINER_TIMEOUT/);
    const meta = await calls("meta");
    expect(meta.filter((c) => c.operation === "container_status")).toHaveLength(4);
    expect(meta.filter((c) => c.operation === "media_publish")).toHaveLength(0);
  });

  it("contrato OpenAI: o pedido usa Structured Outputs strict (o simulador recusa fora do contrato)", async () => {
    const r = await syncResult("megasena");
    await contentJob("RESULT", "megasena", r.draw_id, false);
    const bad = await http(`${svc.mockUrl}/v1/responses`, {
      body: { model: "m", input: "x" },
      headers: { Authorization: "Bearer k" },
    });
    expect(bad.statusCode).toBe(400);
    expect(
      (await calls("openai")).filter((c) => c.operation === "create_response" && c.status === 200),
    ).toHaveLength(1);
  });

  it("CAIXA fora do ar → circuit breaker abre depois de 5 falhas seguidas", async () => {
    await mock({ caixa: { mode: "error500" } });
    for (let i = 0; i < 5; i++)
      expect((await syncResult("megasena")).outcome).toBe("SOURCE_UNAVAILABLE");
    expect((await one("SELECT lc_circuit_allow('lottery_source') AS a")).a.allowed).toBe(false);
  });
});
