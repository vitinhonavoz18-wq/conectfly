/**
 * E2E local: n8n 2.41.x REAL + PostgreSQL + engine + renderer + simuladores
 * (CAIXA, OpenAI, Meta, Supabase Storage). Rodar com: npm run test:e2e
 * Nenhuma API real é chamada.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  count,
  db,
  mockCalls,
  mockScenario,
  N8N,
  posts,
  q,
  resetAll,
  run,
  setSetting,
  TOKEN,
  waitFor,
} from "./helpers.ts";

const RESULT = { game: "megasena", action: "result", dry_run: true };

describe.sequential("E2E — pipeline completo no n8n", () => {
  beforeEach(resetAll);
  afterAll(() => db.end());

  it("webhook sem token é recusado", async () => {
    const res = await fetch(`${N8N}/webhook/loteria-cursos/run`, { method: "POST", body: "{}" });
    expect(res.status).toBe(403);
  });

  it("Cenário 1 — dry-run Mega-Sena: 1 resultado, 1 post, 0 chamadas à Meta (PUBLISHED_SIMULATED)", async () => {
    const r = await run(RESULT);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({
      ok: true,
      game: "megasena",
      contest: 3065,
      numbers: [4, 17, 28, 39, 44, 57],
      instagram_publish: "SKIPPED_DRY_RUN",
      post_status: "PUBLISHED_SIMULATED",
    });
    expect(String(r.json.caption)).toContain("Dezenas sorteadas: 04 · 17 · 28 · 39 · 44 · 57");
    expect(String(r.json.image_url)).toMatch(
      /megasena\/results\/megasena-result-3065-feed-dryrun\.jpg$/,
    );
    expect(await q("SELECT 1 FROM lottery_draws")).toHaveLength(1);
    const p = await posts();
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({
      status: "PUBLISHED_SIMULATED",
      dry_run: true,
      idempotency_key: "result:megasena:3065:feed:dryrun",
      caption_source: "openai",
    });
    expect(await mockCalls("meta")).toHaveLength(0);
    const attempts = await q<{ operation: string; outcome: string; error_code: string | null }>(
      "SELECT operation, outcome, error_code FROM publish_attempts ORDER BY created_at",
    );
    expect(attempts.map((a) => [a.operation, a.outcome])).toEqual([
      ["caption", "ok"],
      ["render", "success"],
      ["dry_run", "skipped"],
    ]);
    expect(attempts[0]!.error_code).toBeNull();
  });

  it("Cenário 2 — mesmo concurso duas vezes: continua 1 resultado e 1 post", async () => {
    const a = await run(RESULT);
    const b = await run(RESULT);
    expect(b.json.outcome).toBe("DUPLICATE");
    expect(b.json.post_id).toBe(a.json.post_id);
    expect(await q("SELECT 1 FROM lottery_draws")).toHaveLength(1);
    expect(await posts()).toHaveLength(1);
    expect(count(await mockCalls("openai"), "create_response")).toBe(1);
  });

  it("Concorrência — duas execuções simultâneas do mesmo concurso não duplicam", async () => {
    const [a, b] = await Promise.all([run(RESULT), run(RESULT)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await q("SELECT 1 FROM lottery_draws")).toHaveLength(1);
    expect(await posts()).toHaveLength(1);
  });

  it.each([
    ["lotofacil", 3502, 15],
    ["quina", 6870, 5],
    ["lotomania", 2860, 20],
  ])("fixture %s funciona de ponta a ponta", async (game, contest, n) => {
    const r = await run({ game, action: "result", dry_run: true });
    expect(r.json).toMatchObject({ ok: true, game, contest, instagram_publish: "SKIPPED_DRY_RUN" });
    expect((r.json.numbers as number[]).length).toBe(n);
  });

  it("Cenário 3 — payload inválido da loteria: FAIL e NADA publicado", async () => {
    await mockScenario({ caixa: { mode: "invalid" } });
    const r = await run(RESULT);
    expect(r.json).toMatchObject({ ok: false, outcome: "INVALID_PAYLOAD", published: false });
    expect(await q("SELECT 1 FROM lottery_draws")).toHaveLength(0);
    expect(await posts()).toHaveLength(0);
    const errors = await q<{ error_code: string }>("SELECT error_code FROM workflow_errors");
    expect(errors.map((e) => e.error_code)).toContain("INVALID_LOTTERY_PAYLOAD");
    expect(await mockCalls("meta")).toHaveLength(0);
  });

  it("Cenário 4 — OpenAI fora do ar: retry controlado e legenda de reserva, sem perder o resultado", async () => {
    await setSetting("openai_max_attempts", 2);
    await mockScenario({ openai: { mode: "error500" } });
    const r = await run(RESULT);
    expect(r.json).toMatchObject({ ok: true, post_status: "PUBLISHED_SIMULATED" });
    const [p] = await posts();
    expect(p!.caption_source).toBe("fallback");
    expect(p!.caption).toContain("RESULTADO MEGA-SENA");
    expect(p!.caption).toContain("Concurso 3065");
    expect(p!.caption).toContain("04 · 17 · 28 · 39 · 44 · 57");
    expect(count(await mockCalls("openai"), "create_response")).toBe(2);
    const caption = await q<{ outcome: string }>(
      "SELECT outcome FROM publish_attempts WHERE operation = 'caption' ORDER BY created_at",
    );
    expect(caption.map((c) => c.outcome)).toEqual(["retry", "fallback"]);
    expect(await q("SELECT 1 FROM lottery_draws")).toHaveLength(1);
  });

  it("Publicação real (Meta simulada): PUBLISHED com ID da mídia e idempotente", async () => {
    await setSetting("enable_real_instagram_publish", true);
    const r = await run({ game: "quina", action: "result", dry_run: false });
    expect(r.json).toMatchObject({
      ok: true,
      instagram_publish: "PUBLISHED",
      post_status: "PUBLISHED",
    });
    const [p] = await posts("quina");
    expect(p).toMatchObject({
      status: "PUBLISHED",
      dry_run: false,
      idempotency_key: "result:quina:6870:feed",
    });
    expect(p!.instagram_media_id).toBeTruthy();
    const meta = await mockCalls("meta");
    expect([count(meta, "create_container"), count(meta, "media_publish")]).toEqual([1, 1]);
    const attempts = await q<{ operation: string; attempt: number }>(
      "SELECT operation, attempt FROM publish_attempts WHERE operation = 'media_publish'",
    );
    expect(attempts).toEqual([{ operation: "media_publish", attempt: 1 }]);
    // De novo: nada de nova chamada à Meta.
    const again = await run({ game: "quina", action: "result", dry_run: false });
    expect(again.json.instagram_publish).toBe("PUBLISHED");
    expect(count(await mockCalls("meta"), "media_publish")).toBe(1);
  });

  it("dry_run=true na chamada vence a configuração de produção (não publica)", async () => {
    await setSetting("enable_real_instagram_publish", true);
    const r = await run({ game: "quina", action: "result", dry_run: true });
    expect(r.json.instagram_publish).toBe("SKIPPED_DRY_RUN");
    expect(await mockCalls("meta")).toHaveLength(0);
  });

  it("Cenário 5 — Meta retorna 429: backoff e retry até publicar", async () => {
    await setSetting("enable_real_instagram_publish", true);
    await mockScenario({ meta: { publish_mode: "rate_limit", publish_fail_times: 1 } });
    const r = await run({ game: "lotofacil", action: "result", dry_run: false });
    expect(r.json).toMatchObject({ instagram_publish: "PUBLISHED" });
    const publishCalls = (await mockCalls("meta")).filter((c) => c.operation === "media_publish");
    expect(publishCalls.map((c) => c.status)).toEqual([429, 200]);
    const attempts = await q<{ outcome: string; error_code: string | null }>(
      "SELECT outcome, error_code FROM publish_attempts WHERE operation = 'media_publish' ORDER BY created_at",
    );
    expect(attempts.map((a) => a.outcome)).toEqual(["retry", "success"]);
    expect(attempts[0]!.error_code).toBe("RATE_LIMITED");
  });

  it("Cenário 6 — token inválido: não repete, FAILED e erro registrado", async () => {
    await setSetting("enable_real_instagram_publish", true);
    await mockScenario({ meta: { create_mode: "invalid_token" } });
    const r = await run({ game: "lotomania", action: "result", dry_run: false });
    expect(r.json).toMatchObject({ ok: false, post_status: "FAILED" });
    const [p] = await posts("lotomania");
    expect(p!.status).toBe("FAILED");
    expect(p!.last_error).toContain("TOKEN_INVALID");
    const meta = await mockCalls("meta");
    expect(count(meta, "create_container")).toBe(1);
    expect(count(meta, "media_publish")).toBe(0);
    const errors = await q<{ error_code: string; message: string }>(
      "SELECT error_code, message FROM workflow_errors",
    );
    expect(errors.map((e) => e.error_code)).toContain("TOKEN_INVALID");
    const [cb] = await q<{ failure_count: number }>(
      "SELECT failure_count FROM circuit_breakers WHERE service = 'meta'",
    );
    expect(cb!.failure_count).toBe(1);
  });

  it("Cenário 8 — container nunca chega em FINISHED: timeout, FAILED, SEM media_publish", async () => {
    await setSetting("enable_real_instagram_publish", true);
    await setSetting("meta_container_max_polls", 3);
    await mockScenario({ meta: { container_mode: "never" } });
    const r = await run({ game: "quina", action: "result", dry_run: false });
    expect(r.json.post_status).toBe("FAILED");
    const [p] = await posts("quina");
    expect(p!.last_error).toContain("CONTAINER_TIMEOUT");
    const meta = await mockCalls("meta");
    expect(count(meta, "container_status")).toBe(3);
    expect(count(meta, "media_publish")).toBe(0);
  });

  it("Cenário 7 — renderer/storage falha: FAILED, nada publicado, erro no tratador", async () => {
    await setSetting("enable_real_instagram_publish", true);
    await mockScenario({ storage: { mode: "error500" } });
    const r = await run({ game: "megasena", action: "result", dry_run: false });
    expect(r.json.post_status).toBe("FAILED");
    const [p] = await posts();
    expect(p!.last_error).toContain("RENDER_FAILED");
    expect(await mockCalls("meta")).toHaveLength(0);
    const errors = await q<{ error_code: string; workflow_name: string }>(
      "SELECT error_code, workflow_name FROM workflow_errors",
    );
    expect(errors).toContainEqual({
      error_code: "RENDER_FAILED",
      workflow_name: "WF-03-Render-Social-Post",
    });
    // O resultado oficial continua salvo.
    expect(await q("SELECT 1 FROM lottery_draws")).toHaveLength(1);
  });

  it("DATA_CONFLICT — mesmo concurso com dezenas diferentes bloqueia a publicação", async () => {
    await run(RESULT);
    await mockScenario({
      caixa: { latest: { megasena: "caixa/conflict/megasena-3065-different.json" } },
    });
    const r = await run(RESULT);
    expect(r.json).toMatchObject({ ok: false, outcome: "DATA_CONFLICT", published: false });
    expect(await q("SELECT 1 FROM data_conflicts")).toHaveLength(1);
    const [d] = await q<{ data_status: string; numbers: number[] }>(
      "SELECT data_status, numbers FROM lottery_draws",
    );
    expect(d).toEqual({ data_status: "CONFLICT", numbers: [4, 17, 28, 39, 44, 57] }); // não sobrescreveu
    const errors = await q<{ error_code: string }>("SELECT error_code FROM workflow_errors");
    expect(errors.map((e) => e.error_code)).toContain("DATA_CONFLICT");
  });

  it("Palpite → resultado → conferência automática (coincidências determinísticas)", async () => {
    await run(RESULT); // 3065 gravado
    const pred = await run({ game: "megasena", action: "prediction", dry_run: true });
    expect(pred.json).toMatchObject({
      ok: true,
      content_type: "PREDICTION",
      contest: 3066,
      instagram_publish: "SKIPPED_DRY_RUN",
    });
    const [prediction] = await q<{ numbers: number[]; method: string }>(
      "SELECT numbers, method FROM predictions",
    );
    expect(prediction!.numbers).toHaveLength(6);
    expect(prediction!.method).toBe("statistical_diversification_v1");
    // Mesmo palpite de novo → idempotente
    await run({ game: "megasena", action: "prediction", dry_run: true });
    expect(await q("SELECT 1 FROM predictions")).toHaveLength(1);

    await mockScenario({ caixa: { latest: { megasena: "caixa/megasena-3066.json" } } });
    const res = await run(RESULT);
    expect(res.json).toMatchObject({ outcome: "INSERTED", contest: 3066 });
    const [checked] = await q<{ hits: number; matching_numbers: number[] }>(
      "SELECT hits, matching_numbers FROM predictions",
    );
    const expected = prediction!.numbers.filter((n) => [4, 10, 28, 39, 51, 60].includes(n));
    expect(checked).toEqual({ hits: expected.length, matching_numbers: expected });
    const types = (await posts()).map((p) => `${p.type}:${p.contest}:${p.status}`).sort();
    expect(types).toEqual([
      "CHECK:3066:PUBLISHED_SIMULATED",
      "PREDICTION:3066:PUBLISHED_SIMULATED",
      "RESULT:3065:PUBLISHED_SIMULATED",
      "RESULT:3066:PUBLISHED_SIMULATED",
    ]);
    const check = (await posts()).find((p) => p.type === "CHECK")!;
    expect(check.caption).toContain(`Coincidências: ${expected.length}`);
    expect(check.caption).toContain("Coincidência não significa prêmio");
  });

  it("Polling — espera o concurso novo com backoff e para quando aparece", async () => {
    await mockScenario({ caixa: { latest: { megasena: "caixa/megasena-3064.json" } } });
    await run(RESULT); // linha de base: 3064
    await mockScenario({
      caixa: {
        sequence: {
          megasena: ["caixa/megasena-3064.json", "caixa/megasena-3064.json", "caixa/megasena.json"],
        },
      },
    });
    const r = await run({ game: "megasena", action: "poll", dry_run: true });
    expect(r.json).toMatchObject({ outcome: "INSERTED", contest: 3065 });
    expect(count(await mockCalls("caixa"), "fetch_latest")).toBe(4); // 1 base + 3 polling
    const [runRow] = await q<{ status: string; attempts: number }>(
      "SELECT status, attempts FROM result_poll_runs",
    );
    expect(runRow).toEqual({ status: "FOUND", attempts: 3 });
  });

  it("Polling — sem concurso novo: para após o máximo de tentativas (sem loop infinito)", async () => {
    await mockScenario({ caixa: { latest: { megasena: "caixa/megasena-3064.json" } } });
    await run(RESULT);
    const r = await run({ game: "megasena", action: "poll", dry_run: true });
    expect(r.json).toMatchObject({ ok: false, outcome: "RESULT_NOT_AVAILABLE" });
    const [runRow] = await q<{ status: string; attempts: number }>(
      "SELECT status, attempts FROM result_poll_runs",
    );
    expect(runRow).toEqual({ status: "EXHAUSTED", attempts: 3 });
    expect(count(await mockCalls("caixa"), "fetch_latest")).toBe(4);
  });

  it("Backfill — completa o histórico sem gerar posts", async () => {
    await run(RESULT);
    const r = await run({ game: "megasena", action: "backfill", count: 3 });
    expect(r.json).toMatchObject({ ok: true, outcome: "BACKFILL_DONE" });
    const draws = await q<{ contest: string; is_backfill: boolean }>(
      "SELECT contest, is_backfill FROM lottery_draws ORDER BY contest",
    );
    expect(draws).toEqual([
      { contest: "3064", is_backfill: true },
      { contest: "3065", is_backfill: false },
    ]);
    expect(await posts()).toHaveLength(1);
  });

  it("Analytics — coleta métricas oficiais do post publicado e registra métrica recusada", async () => {
    await setSetting("enable_real_instagram_publish", true);
    await run({ game: "quina", action: "result", dry_run: false });
    const r = await run({ action: "insights" });
    expect(r.status).toBe(200);
    const [ins] = await q<{ metrics: Record<string, number>; error: string | null }>(
      "SELECT metrics, error FROM instagram_insights",
    );
    expect(ins!.error).toBeNull();
    expect(Object.keys(ins!.metrics)).toEqual(expect.arrayContaining(["views", "reach", "likes"]));
    // Métrica removida pela Meta → erro registrado, sem derrubar o fluxo.
    await q("DELETE FROM instagram_insights");
    await setSetting("instagram_insight_metrics", { IMAGE: ["impressions"] });
    await run({ action: "insights" });
    const [bad] = await q<{ error: string | null; http_status: number }>(
      "SELECT error, http_status FROM instagram_insights",
    );
    expect(bad!.http_status).toBe(400);
    expect(bad!.error).toContain("metric");
    await setSetting("instagram_insight_metrics", {
      IMAGE: ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"],
    });
  });

  it("WF-00 — health check estruturado", async () => {
    const res = await fetch(`${N8N}/webhook/loteria-cursos/health`, {
      headers: { "X-LC-Token": TOKEN },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; services: Record<string, string> };
    expect(body.services).toEqual({
      n8n: "ok",
      database: "ok",
      engine: "ok",
      lottery_source: "ok",
      openai: "ok",
      renderer: "ok",
      storage: "ok",
      meta: "ok",
    });
    expect(body.status).toBe("ok");
    expect(count(await mockCalls("openai"), "create_response")).toBe(0); // health não gera custo
  });

  it("WF-99 — falha inesperada aciona o Error Trigger e é registrada sem segredos", async () => {
    const r = await run({ action: "test_error" });
    expect(r.status).toBeGreaterThanOrEqual(500);
    const row = await waitFor(
      async () =>
        (
          await q<Record<string, unknown>>(
            "SELECT * FROM workflow_errors WHERE error_code = 'ERROR_HANDLER_TEST'",
          )
        )[0],
      30_000,
    );
    expect(row).toMatchObject({
      workflow_name: "WF-07-Content-Orchestrator",
      node: "Stop — Error Handler Test",
    });
    expect(row.execution_id).toBeTruthy();
  });

  it("Segurança — nenhum token/chave aparece em logs do banco", async () => {
    await setSetting("enable_real_instagram_publish", true);
    await mockScenario({ meta: { create_mode: "invalid_token" } });
    await run({ game: "megasena", action: "result", dry_run: false });
    const dump = JSON.stringify([
      await q("SELECT * FROM publish_attempts"),
      await q("SELECT * FROM workflow_errors"),
      await q("SELECT * FROM social_posts"),
      await q("SELECT * FROM system_settings"),
    ]);
    for (const secret of [
      "mock-meta-token",
      "mock-openai-key",
      "mock-service-role-key",
      "e2e-test-only-password",
      TOKEN,
    ]) {
      expect(dump).not.toContain(secret);
    }
  });
});
