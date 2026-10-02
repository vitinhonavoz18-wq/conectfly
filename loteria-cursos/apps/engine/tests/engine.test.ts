import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeCaixaPayload,
  type LotterySourceAdapter,
  type SourceGameConfig,
} from "@lc/lottery-core";
import { createLogger } from "@lc/shared";
import { buildEngine } from "../src/app.ts";

const FIX = join(import.meta.dirname, "..", "..", "..", "fixtures");
const fx = (rel: string) => JSON.parse(readFileSync(join(FIX, rel), "utf8"));
const silent = createLogger({ service: "test", sink: () => {} });
const mega = {
  slug: "megasena",
  name: "Mega-Sena",
  numbers_per_bet: 6,
  numbers_drawn: 6,
  min_number: 1,
  max_number: 60,
  source_code: "megasena",
  source_game_type: "MEGA_SENA",
  timezone: "America/Bahia",
};

function fakeSource(file: string | null, unavailable = false): LotterySourceAdapter {
  const run = async (g: SourceGameConfig) => {
    if (unavailable)
      return {
        ok: false as const,
        errorCode: "SOURCE_UNAVAILABLE" as const,
        retryable: true,
        message: "fora do ar",
      };
    return normalizeCaixaPayload(fx(file!), g, {
      sourceUrl: "fake://",
      fetchedAt: new Date("2026-10-02T12:00:00Z"),
    });
  };
  return { name: "fake", fetchLatest: run, fetchContest: (g) => run(g) };
}

describe("engine HTTP", () => {
  it("GET /health", async () => {
    const app = buildEngine({ source: fakeSource("caixa/megasena.json"), logger: silent });
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(200);
    expect(r.json().status).toBe("ok");
    expect(r.headers["x-correlation-id"]).toBeTruthy();
  });

  it("POST /v1/results/fetch devolve resultado normalizado e validado", async () => {
    const app = buildEngine({ source: fakeSource("caixa/megasena.json"), logger: silent });
    const r = await app.inject({
      method: "POST",
      url: "/v1/results/fetch",
      payload: { game: mega },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().draw).toMatchObject({ contest: 3065, numbers: [4, 17, 28, 39, 44, 57] });
  });

  it("payload inválido da fonte → 422 INVALID_PAYLOAD (não publicar)", async () => {
    const app = buildEngine({
      source: fakeSource("caixa/invalid/megasena-out-of-range.json"),
      logger: silent,
    });
    const r = await app.inject({
      method: "POST",
      url: "/v1/results/fetch",
      payload: { game: mega },
    });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({ ok: false, outcome: "INVALID_PAYLOAD", retryable: false });
  });

  it("fonte fora do ar → 503 retryable", async () => {
    const app = buildEngine({ source: fakeSource(null, true), logger: silent });
    const r = await app.inject({
      method: "POST",
      url: "/v1/results/fetch",
      payload: { game: mega },
    });
    expect(r.statusCode).toBe(503);
    expect(r.json().retryable).toBe(true);
  });

  it("entrada malformada → 400", async () => {
    const app = buildEngine({ source: fakeSource("caixa/megasena.json"), logger: silent });
    const r = await app.inject({
      method: "POST",
      url: "/v1/results/fetch",
      payload: { game: { slug: "Mega Sena" } },
    });
    expect(r.statusCode).toBe(400);
  });

  it("gera palpites determinísticos com semente padrão por concurso", async () => {
    const app = buildEngine({ source: fakeSource("caixa/megasena.json"), logger: silent });
    const body = {
      game: mega,
      contest: 3066,
      history: [{ contest: 3065, numbers: [4, 17, 28, 39, 44, 57] }],
      count: 2,
    };
    const a = (
      await app.inject({ method: "POST", url: "/v1/predictions/generate", payload: body })
    ).json();
    const b = (
      await app.inject({ method: "POST", url: "/v1/predictions/generate", payload: body })
    ).json();
    expect(a.predictions).toHaveLength(2);
    expect(a.seed).toBe("megasena:3066:statistical_diversification_v1:1.0.0");
    expect(a.predictions).toEqual(b.predictions);
  });

  it("confere palpites deterministicamente", async () => {
    const app = buildEngine({ source: fakeSource("caixa/megasena.json"), logger: silent });
    const r = await app.inject({
      method: "POST",
      url: "/v1/predictions/check",
      payload: {
        game: mega,
        result_numbers: [4, 10, 28, 39, 51, 60],
        predictions: [{ id: "p1", numbers: [4, 17, 28, 39, 44, 57] }],
      },
    });
    expect(r.json().checks).toEqual([{ id: "p1", hits: 3, matching_numbers: [4, 28, 39] }]);
  });

  it("plano de conteúdo inválido → 422", async () => {
    const app = buildEngine({ source: fakeSource("caixa/megasena.json"), logger: silent });
    const r = await app.inject({
      method: "POST",
      url: "/v1/content/plan",
      payload: { content_type: "RESULT" },
    });
    expect(r.statusCode).toBe(422);
  });

  it("classifica respostas da Meta", async () => {
    const app = buildEngine({ source: fakeSource("caixa/megasena.json"), logger: silent });
    const r = await app.inject({
      method: "POST",
      url: "/v1/meta/classify",
      payload: {
        operation: "media_publish",
        status_code: 400,
        body: fx("meta/error-invalid-token.json"),
        attempt: 1,
        max_attempts: 4,
      },
    });
    expect(r.json()).toMatchObject({
      outcome: "fail",
      permanent: true,
      error_code: "TOKEN_INVALID",
    });
  });

  it("decide polling de resultado sem loop infinito", async () => {
    const app = buildEngine({ source: fakeSource("caixa/megasena.json"), logger: silent });
    const stop = await app.inject({
      method: "POST",
      url: "/v1/results/poll-decision",
      payload: { attempt: 10, max_attempts: 10, interval_seconds: 180 },
    });
    expect(stop.json().outcome).toBe("stop");
  });
});
