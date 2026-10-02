/**
 * Integração com PostgreSQL REAL: constraints, triggers, máquina de estados,
 * idempotência sob concorrência, circuit breaker, agenda de sorteios.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GAMES,
  POST_STATUSES,
  canTransition,
  normalizeCaixaPayload,
  planContent,
} from "@lc/lottery-core";
// @ts-expect-error módulo JS sem tipos
import { migrate, coerceSetting } from "../../database/migrate.mjs";
import { DB_URL, ensureMigrated, fixture, one, pool, q, resetDb } from "./support.ts";

const megaDraw = () => {
  const r = normalizeCaixaPayload(
    fixture("caixa/megasena.json"),
    { ...DEFAULT_GAMES.megasena! },
    { sourceUrl: "x", fetchedAt: new Date("2026-10-02T12:00:00Z") },
  );
  if (!r.ok) throw new Error("fixture inválida");
  return r.draw;
};
const ingest = (draw: unknown, slug = "megasena", backfill = false) =>
  one<{ r: any }>("SELECT lc_ingest_draw($1, $2::jsonb, $3) AS r", [
    slug,
    JSON.stringify(draw),
    backfill,
  ]).then((x) => x.r);

async function createPost(dryRun = true) {
  const d = await ingest(megaDraw());
  const ctx = (
    await one<{ ctx: any }>("SELECT lc_content_context($1::jsonb) AS ctx", [
      JSON.stringify({ content_type: "RESULT", game: "megasena", draw_id: d.draw_id }),
    ])
  ).ctx;
  const plan = planContent({
    content_type: "RESULT",
    format: "feed",
    dry_run: dryRun,
    brand_name: "LOTERIA CURSOS",
    default_cta: "CTA",
    openai_model: "m",
    game: ctx.game,
    draw: ctx.draw,
  });
  return (
    await one<{ u: any }>("SELECT lc_upsert_post($1::jsonb, 'int') AS u", [JSON.stringify(plan)])
  ).u;
}

beforeAll(ensureMigrated);
beforeEach(resetDb);
afterAll(() => pool.end());

describe("migrations e seeds", () => {
  it("rodar de novo é idempotente (nada reaplicado, seeds preservam edições)", async () => {
    await q("UPDATE lottery_games SET brand_color = '#000000' WHERE slug = 'quina'");
    await migrate({ databaseUrl: DB_URL, env: {}, log: () => {} });
    expect(
      (await one("SELECT brand_color FROM lottery_games WHERE slug = 'quina'")).brand_color,
    ).toBe("#000000");
    await q("UPDATE lottery_games SET brand_color = $1 WHERE slug = 'quina'", [
      DEFAULT_GAMES.quina!.brandColor,
    ]);
    expect((await q("SELECT version FROM schema_migrations")).length).toBe(5);
  });

  it("seed das modalidades bate com as regras do lottery-core", async () => {
    const rows = await q("SELECT * FROM lottery_games ORDER BY slug");
    expect(rows.map((r) => r.slug)).toEqual(["lotofacil", "lotomania", "megasena", "quina"]);
    for (const r of rows) {
      const g = DEFAULT_GAMES[r.slug]!;
      expect([
        r.numbers_drawn,
        r.numbers_per_bet,
        r.min_number,
        r.max_number,
        r.brand_color,
        r.source_game_type,
      ]).toEqual([
        g.numbersDrawn,
        g.numbersPerBet,
        g.minNumber,
        g.maxNumber,
        g.brandColor,
        g.sourceGameType,
      ]);
      expect(r.draw_schedule).toEqual(g.drawSchedule);
      expect(r.timezone).toBe("America/Bahia");
    }
  });

  it("sincronização de configurações recusa valores com cara de segredo", () => {
    expect(() =>
      coerceSetting("OPENAI_MODEL", ["sk", "abcdefghijklmnopqrstuvwxyz"].join("-"), "string"),
    ).toThrow(/segredo/);
    expect(coerceSetting("ENABLE_REAL_INSTAGRAM_PUBLISH", "false", "bool")).toBe(false);
    expect(() => coerceSetting("ENABLE_REAL_INSTAGRAM_PUBLISH", "talvez", "bool")).toThrow();
  });

  it("RLS ligado em todas as tabelas da aplicação (proteção da API REST do Supabase)", async () => {
    const rows = await q(
      "SELECT relname, relrowsecurity FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace AND relname <> 'schema_migrations'",
    );
    expect(rows.length).toBeGreaterThanOrEqual(12);
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });

  it("system_settings não aceita marcar segredo", async () => {
    await expect(
      q("INSERT INTO system_settings (key, value, is_secret) VALUES ('x', '1', true)"),
    ).rejects.toThrow();
  });
});

describe("resultados oficiais", () => {
  it("INSERT → DUPLICATE (mesmo hash) → CONFLICT (hash diferente, não sobrescreve)", async () => {
    const d = megaDraw();
    expect((await ingest(d)).outcome).toBe("INSERTED");
    expect((await ingest(d)).outcome).toBe("DUPLICATE");
    const conflict = await ingest({
      ...d,
      numbers: [4, 17, 28, 39, 44, 58],
      source_hash: "b".repeat(64),
    });
    expect(conflict.outcome).toBe("CONFLICT");
    const row = await one("SELECT numbers, data_status FROM lottery_draws");
    expect(row).toEqual({ numbers: [4, 17, 28, 39, 44, 57], data_status: "CONFLICT" });
    expect((await q("SELECT 1 FROM data_conflicts")).length).toBe(1);
    // post não é criado para resultado em conflito
    const ctx = (
      await one("SELECT lc_content_context($1::jsonb) AS c", [
        JSON.stringify({ content_type: "RESULT", game: "megasena", contest: 3065 }),
      ])
    ).c;
    expect(ctx.outcome).toBe("DATA_CONFLICT");
  });

  it("10 ingestões simultâneas do mesmo concurso geram 1 linha (UNIQUE + ON CONFLICT)", async () => {
    const d = megaDraw();
    const results = await Promise.all(Array.from({ length: 10 }, () => ingest(d)));
    expect(results.filter((r) => r.outcome === "INSERTED")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "DUPLICATE")).toHaveLength(9);
    expect((await q("SELECT 1 FROM lottery_draws")).length).toBe(1);
  });

  it("banco recusa dezenas inválidas mesmo se o app falhar (trigger)", async () => {
    const g = await one("SELECT id FROM lottery_games WHERE slug = 'megasena'");
    const insert = (numbers: unknown) =>
      q(
        `INSERT INTO lottery_draws (game_id, contest, draw_date, draw_day, numbers, accumulated, raw_payload, source, source_hash, fetched_at)
         VALUES ($1, 1, now(), current_date, $2::jsonb, false, '{}', 't', $3, now())`,
        [g.id, JSON.stringify(numbers), "c".repeat(64)],
      );
    await expect(insert([1, 2, 3, 4, 5, 61])).rejects.toThrow(/INVALID_DRAW_NUMBERS/);
    await expect(insert([1, 1, 3, 4, 5, 6])).rejects.toThrow(/INVALID_DRAW_NUMBERS/);
    await expect(insert([1, 2, 3, 4, 5])).rejects.toThrow(/INVALID_DRAW_NUMBERS/);
    await expect(insert(["1", 2, 3, 4, 5, 6])).rejects.toThrow(/INVALID_DRAW_NUMBERS/);
    expect((await ingest({ ...megaDraw(), numbers: [1, 2, 3] })).outcome).toBe("INVALID");
  });

  it("resultado gravado é imutável", async () => {
    await ingest(megaDraw());
    await expect(q("UPDATE lottery_draws SET numbers = '[1,2,3,4,5,6]'")).rejects.toThrow(
      /OFFICIAL_RESULT_IMMUTABLE/,
    );
  });

  it("palpite inválido é recusado pelo banco; palpites são idempotentes", async () => {
    await ingest(megaDraw());
    const save = (numbers: number[]) =>
      one("SELECT lc_save_predictions($1::jsonb) AS s", [
        JSON.stringify({
          game: "megasena",
          contest: 3066,
          method: "m",
          algorithm_version: "1",
          seed: "s",
          predictions: [{ numbers }],
        }),
      ]);
    await expect(save([1, 2, 3, 4, 5, 99])).rejects.toThrow(/INVALID_PREDICTION_NUMBERS/);
    await save([1, 2, 3, 4, 5, 6]);
    await save([7, 8, 9, 10, 11, 12]); // mesma variante → ignorado
    const rows = await q("SELECT numbers FROM predictions");
    expect(rows).toEqual([{ numbers: [1, 2, 3, 4, 5, 6] }]);
  });
});

describe("posts: idempotência e máquina de estados", () => {
  it("máquina de estados do banco é idêntica à do TypeScript (todas as combinações)", async () => {
    for (const from of POST_STATUSES) {
      for (const to of POST_STATUSES) {
        if (from === to) continue;
        const { ok } = await one("SELECT lc_post_transition_allowed($1, $2) AS ok", [from, to]);
        expect(ok, `${from}->${to}`).toBe(canTransition(from, to));
      }
    }
  });

  it("20 criações simultâneas com a mesma chave geram 1 post", async () => {
    const d = await ingest(megaDraw());
    const ctx = (
      await one("SELECT lc_content_context($1::jsonb) AS c", [
        JSON.stringify({ content_type: "RESULT", game: "megasena", draw_id: d.draw_id }),
      ])
    ).c;
    const plan = planContent({
      content_type: "RESULT",
      format: "feed",
      dry_run: false,
      brand_name: "B",
      default_cta: "C",
      openai_model: "m",
      game: ctx.game,
      draw: ctx.draw,
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        one("SELECT lc_upsert_post($1::jsonb) AS u", [JSON.stringify(plan)]),
      ),
    );
    expect(results.filter((r) => r.u.inserted)).toHaveLength(1);
    expect(new Set(results.map((r) => r.u.post.id)).size).toBe(1);
    expect((await q("SELECT 1 FROM social_posts")).length).toBe(1);
  });

  it("claim RENDERED→PUBLISHING é atômico: 10 tentativas, só 1 vence", async () => {
    const u = await createPost(false);
    const id = u.post.id;
    for (const [from, to] of [
      ["DRAFT", "READY"],
      ["READY", "RENDERING"],
      ["RENDERING", "RENDERED"],
    ]) {
      await q("SELECT lc_transition_post($1, ARRAY[$2], $3, '{}'::jsonb)", [id, from, to]);
    }
    const claims = await Promise.all(
      Array.from({ length: 10 }, () =>
        one("SELECT lc_transition_post($1, ARRAY['RENDERED'], 'PUBLISHING', '{}'::jsonb) AS c", [
          id,
        ]),
      ),
    );
    expect(claims.filter((c) => c.c.transitioned)).toHaveLength(1);
  });

  it("PUBLISHED nunca volta a publicar e o ID da mídia é imutável", async () => {
    const u = await createPost(false);
    const id = u.post.id;
    for (const [from, to] of [
      ["DRAFT", "READY"],
      ["READY", "RENDERING"],
      ["RENDERING", "RENDERED"],
      ["RENDERED", "PUBLISHING"],
    ]) {
      await q("SELECT lc_transition_post($1, ARRAY[$2], $3, '{}'::jsonb)", [id, from, to]);
    }
    await q(
      "SELECT lc_transition_post($1, ARRAY['PUBLISHING'], 'PUBLISHED', jsonb_build_object('instagram_media_id', '999'))",
      [id],
    );
    // Fluxo normal (claim a partir de RENDERED): não pega o post publicado.
    const again = await one(
      "SELECT lc_transition_post($1, ARRAY['RENDERED'], 'PUBLISHING', '{}'::jsonb) AS r",
      [id],
    );
    expect(again.r).toMatchObject({ transitioned: false, outcome: "SKIPPED_STATUS_PUBLISHED" });
    // Mesmo um chamador com bug pedindo PUBLISHED→PUBLISHING é barrado com erro explícito.
    await expect(
      q("SELECT lc_transition_post($1, ARRAY['PUBLISHED'], 'PUBLISHING', '{}'::jsonb)", [id]),
    ).rejects.toThrow(/INVALID_POST_TRANSITION PUBLISHED->PUBLISHING/);
    await expect(
      q("UPDATE social_posts SET status = 'PUBLISHING' WHERE id = $1", [id]),
    ).rejects.toThrow(/INVALID_POST_TRANSITION/);
    await expect(
      q("UPDATE social_posts SET instagram_media_id = '111' WHERE id = $1", [id]),
    ).rejects.toThrow(/INSTAGRAM_MEDIA_ID_IMMUTABLE/);
    await expect(q("SELECT lc_requeue_post($1)", [id])).resolves.toBeDefined();
    expect((await one("SELECT status FROM social_posts WHERE id = $1", [id])).status).toBe(
      "PUBLISHED",
    );
  });

  it("transições inválidas geram erro (não passam caladas)", async () => {
    const u = await createPost();
    await expect(
      q("UPDATE social_posts SET status = 'PUBLISHED' WHERE id = $1", [u.post.id]),
    ).rejects.toThrow(/INVALID_POST_TRANSITION DRAFT->PUBLISHED/);
    await expect(
      q("UPDATE social_posts SET idempotency_key = 'x' WHERE id = $1", [u.post.id]),
    ).rejects.toThrow(/POST_IDENTITY_IMMUTABLE/);
  });

  it("posts presos são recuperados para FAILED (PUBLISHING nunca é republicado sozinho)", async () => {
    const u = await createPost(false);
    const id = u.post.id;
    for (const [from, to] of [
      ["DRAFT", "READY"],
      ["READY", "RENDERING"],
      ["RENDERING", "RENDERED"],
      ["RENDERED", "PUBLISHING"],
    ]) {
      await q("SELECT lc_transition_post($1, ARRAY[$2], $3, '{}'::jsonb)", [id, from, to]);
    }
    await q("ALTER TABLE social_posts DISABLE TRIGGER social_posts_guard");
    await q(
      "UPDATE social_posts SET status_changed_at = now() - interval '2 hours' WHERE id = $1",
      [id],
    );
    await q("ALTER TABLE social_posts ENABLE TRIGGER social_posts_guard");
    expect((await one("SELECT lc_recover_stuck_posts(30) AS r")).r.recovered).toBe(1);
    const p = await one("SELECT status, last_error FROM social_posts WHERE id = $1", [id]);
    expect(p.status).toBe("FAILED");
    expect(p.last_error).toContain("STUCK_PUBLISHING_REVIEW_REQUIRED");
  });
});

describe("circuit breaker", () => {
  it("CLOSED → OPEN após o limite → bloqueia → HALF_OPEN após cooldown → CLOSED com sucesso", async () => {
    for (let i = 0; i < 2; i++) await q("SELECT lc_circuit_record('meta', false, 'x')");
    expect((await one("SELECT lc_circuit_allow('meta') AS a")).a.allowed).toBe(true);
    await q("SELECT lc_circuit_record('meta', false, 'x')");
    const blocked = (await one("SELECT lc_circuit_allow('meta') AS a")).a;
    expect(blocked).toMatchObject({ allowed: false, circuit_status: "OPEN" });
    await q(
      "UPDATE circuit_breakers SET opened_at = now() - interval '1 day' WHERE service = 'meta'",
    );
    expect((await one("SELECT lc_circuit_allow('meta') AS a")).a).toMatchObject({
      allowed: true,
      circuit_status: "HALF_OPEN",
    });
    expect((await one("SELECT lc_circuit_allow('meta') AS a")).a.allowed).toBe(false); // só 1 sonda por vez
    await q("SELECT lc_circuit_record('meta', true)");
    expect(
      await one(
        "SELECT circuit_status, failure_count FROM circuit_breakers WHERE service = 'meta'",
      ),
    ).toEqual({ circuit_status: "CLOSED", failure_count: 0 });
  });

  it("falha na sonda HALF_OPEN reabre o circuito", async () => {
    for (let i = 0; i < 3; i++) await q("SELECT lc_circuit_record('meta', false, 'x')");
    await q(
      "UPDATE circuit_breakers SET opened_at = now() - interval '1 day' WHERE service = 'meta'",
    );
    await q("SELECT lc_circuit_allow('meta')");
    expect((await one("SELECT lc_circuit_record('meta', false, 'y') AS r")).r.circuit_status).toBe(
      "OPEN",
    );
  });
});

describe("agenda (horários vêm do banco, fuso America/Bahia)", () => {
  const jobs = (at: string) =>
    q(
      "SELECT job_type, game_slug, contest FROM lc_due_jobs($1::timestamptz) ORDER BY job_type, game_slug",
      [at],
    );

  it("quinta 21:30: buscar resultado de Mega-Sena, Lotofácil e Quina (Lotomania não sorteia)", async () => {
    expect(await jobs("2026-10-01 21:30-03")).toEqual([
      { job_type: "RESULT_POLL", game_slug: "lotofacil", contest: null },
      { job_type: "RESULT_POLL", game_slug: "megasena", contest: null },
      { job_type: "RESULT_POLL", game_slug: "quina", contest: null },
    ]);
  });

  it("antes da janela de espera não há polling", async () => {
    expect(await jobs("2026-10-01 21:10-03")).toEqual([]);
  });

  it("domingo 11h (novo horário de 2026): palpite abre 5h antes", async () => {
    await ingest(megaDraw()); // próximo sorteio informado pela fonte: 04/10 (domingo)
    const at6 = await jobs("2026-10-04 06:30-03");
    expect(at6).toContainEqual({ job_type: "PREDICTION", game_slug: "megasena", contest: "3066" });
    expect(await jobs("2026-10-04 05:30-03")).not.toContainEqual(
      expect.objectContaining({ job_type: "PREDICTION", game_slug: "megasena" }),
    );
  });

  it("modalidade desativada some da agenda", async () => {
    await q("UPDATE lottery_games SET enabled = false WHERE slug <> 'quina'");
    const r = await jobs("2026-10-01 21:30-03");
    await q("UPDATE lottery_games SET enabled = true");
    expect(r).toEqual([{ job_type: "RESULT_POLL", game_slug: "quina", contest: null }]);
  });

  it("rodada de polling não roda duas vezes em paralelo para o mesmo sorteio", async () => {
    const claims = await Promise.all(
      Array.from({ length: 5 }, () =>
        one("SELECT lc_claim_poll_run('megasena', '2026-10-01 21:00-03') AS c"),
      ),
    );
    expect(claims.filter((c) => c.c.claimed)).toHaveLength(1);
  });
});
