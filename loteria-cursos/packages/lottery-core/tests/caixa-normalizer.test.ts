import { describe, expect, it, vi } from "vitest";
import {
  CaixaSourceAdapter,
  normalizeCaixaPayload,
  computeSourceHash,
  parseBrDate,
  zonedToUtcIso,
  parseMoney,
} from "../src/index.ts";
import { fixture, game, FIXED_NOW } from "./helpers.ts";

const meta = { sourceUrl: "https://example.test/megasena", fetchedAt: FIXED_NOW };

describe("normalizeCaixaPayload — contrato com as fixtures", () => {
  it.each([
    ["megasena", "caixa/megasena.json", 3065, 6],
    ["lotofacil", "caixa/lotofacil.json", 3502, 15],
    ["quina", "caixa/quina.json", 6870, 5],
    ["lotomania", "caixa/lotomania.json", 2860, 20],
  ])("%s: normaliza, ordena e calcula hash", (slug, file, contest, count) => {
    const r = normalizeCaixaPayload(fixture(file), game(slug), meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draw.game).toBe(slug);
    expect(r.draw.contest).toBe(contest);
    expect(r.draw.numbers).toHaveLength(count);
    expect([...r.draw.numbers].sort((a, b) => a - b)).toEqual(r.draw.numbers);
    expect(r.draw.numbers.every(Number.isInteger)).toBe(true);
    expect(r.draw.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(r.draw.raw_payload).toEqual(fixture(file));
  });

  it("Mega-Sena: dezenas oficiais preservadas exatamente (só ordenadas)", () => {
    const r = normalizeCaixaPayload(fixture("caixa/megasena.json"), game("megasena"), meta);
    expect(r.ok && r.draw.numbers).toEqual([4, 17, 28, 39, 44, 57]);
    expect(r.ok && r.draw.draw_order).toEqual([39, 4, 57, 17, 44, 28]);
    expect(r.ok && r.draw.draw_day).toBe("2026-10-01");
    expect(r.ok && r.draw.draw_date).toBe("2026-10-01T03:00:00.000Z");
    expect(r.ok && r.draw.accumulated).toBe(true);
    expect(r.ok && r.draw.estimated_prize).toBe(45000000);
    expect(r.ok && r.draw.next_contest).toBe(3066);
  });

  it("Lotomania aceita a dezena 00", () => {
    const r = normalizeCaixaPayload(fixture("caixa/lotomania.json"), game("lotomania"), meta);
    expect(r.ok && r.draw.numbers[0]).toBe(0);
    expect(r.ok && r.draw.numbers.at(-1)).toBe(99);
  });

  it.each([
    "megasena-duplicate-numbers",
    "megasena-out-of-range",
    "megasena-wrong-count",
    "megasena-wrong-game",
    "megasena-order-mismatch",
    "megasena-bad-date",
    "megasena-future-date",
    "megasena-missing-field",
    "megasena-text-number",
    "megasena-next-contest-mismatch",
  ])("bloqueia payload inválido: %s", (name) => {
    const r = normalizeCaixaPayload(fixture(`caixa/invalid/${name}.json`), game("megasena"), meta);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorCode).toBe("INVALID_PAYLOAD");
      expect(r.retryable).toBe(false);
    }
  });

  it("concurso sem dezenas ainda = RESULT_NOT_READY (transitório)", () => {
    const r = normalizeCaixaPayload(
      fixture("caixa/not-ready/megasena.json"),
      game("megasena"),
      meta,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorCode).toBe("RESULT_NOT_READY");
      expect(r.retryable).toBe(true);
    }
  });

  it("hash muda quando a dezena muda e não muda com estimativa de prêmio", () => {
    const a = normalizeCaixaPayload(fixture("caixa/megasena.json"), game("megasena"), meta);
    const b = normalizeCaixaPayload(
      fixture("caixa/conflict/megasena-3065-different.json"),
      game("megasena"),
      meta,
    );
    const c = normalizeCaixaPayload(
      { ...(fixture("caixa/megasena.json") as object), valorEstimadoProximoConcurso: 47000000 },
      game("megasena"),
      meta,
    );
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (a.ok && b.ok && c.ok) {
      expect(a.draw.source_hash).not.toBe(b.draw.source_hash);
      expect(a.draw.source_hash).toBe(c.draw.source_hash);
      expect(computeSourceHash(a.draw)).toBe(a.draw.source_hash);
    }
  });
});

describe("CaixaSourceAdapter — HTTP", () => {
  const okResponse = (body: unknown, status = 200) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  const make = (fetchImpl: ReturnType<typeof vi.fn>) =>
    new CaixaSourceAdapter({
      baseUrl: "https://caixa.test/api",
      fetchImpl: fetchImpl as never,
      sleepImpl: async () => {},
      now: () => FIXED_NOW,
      maxAttempts: 3,
    });

  it("busca o último resultado na URL correta", async () => {
    const f = vi.fn().mockResolvedValue(okResponse(fixture("caixa/megasena.json")));
    const r = await make(f).fetchLatest(game("megasena"));
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledWith("https://caixa.test/api/megasena", expect.anything());
  });

  it("repete erro 5xx e depois desiste com SOURCE_UNAVAILABLE", async () => {
    const f = vi.fn().mockImplementation(async () => okResponse("erro", 503));
    const r = await make(f).fetchLatest(game("megasena"));
    expect(f).toHaveBeenCalledTimes(3);
    expect(!r.ok && r.errorCode).toBe("SOURCE_UNAVAILABLE");
  });

  it("recupera após falha de rede transitória", async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(okResponse(fixture("caixa/megasena.json")));
    const r = await make(f).fetchLatest(game("megasena"));
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("HTTP 200 com HTML não é resultado", async () => {
    const f = vi.fn().mockImplementation(async () => okResponse("<html>manutenção</html>"));
    const r = await make(f).fetchLatest(game("megasena"));
    expect(!r.ok && r.errorCode).toBe("SOURCE_UNAVAILABLE");
  });

  it("HTTP 200 com JSON inválido NÃO é repetido e bloqueia", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(okResponse(fixture("caixa/invalid/megasena-duplicate-numbers.json")));
    const r = await make(f).fetchLatest(game("megasena"));
    expect(f).toHaveBeenCalledTimes(1);
    expect(!r.ok && r.errorCode).toBe("INVALID_PAYLOAD");
  });

  it("fetchContest recusa concurso diferente do pedido", async () => {
    const f = vi.fn().mockResolvedValue(okResponse(fixture("caixa/megasena.json")));
    const r = await make(f).fetchContest(game("megasena"), 3000);
    expect(!r.ok && r.errorCode).toBe("INVALID_PAYLOAD");
  });

  it("404 vira NOT_FOUND sem repetir", async () => {
    const f = vi.fn().mockResolvedValue(okResponse("{}", 404));
    const r = await make(f).fetchContest(game("megasena"), 99999);
    expect(!r.ok && r.errorCode).toBe("NOT_FOUND");
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("helpers de data e dinheiro", () => {
  it("parseBrDate valida datas reais", () => {
    expect(parseBrDate("01/10/2026")).toBe("2026-10-01");
    expect(parseBrDate("31/02/2026")).toBeNull();
    expect(parseBrDate("2026-10-01")).toBeNull();
  });
  it("converte horário de America/Bahia (UTC−3) para UTC", () => {
    expect(zonedToUtcIso("2026-10-01", "21:00", "America/Bahia")).toBe("2026-10-02T00:00:00.000Z");
  });
  it("parseMoney entende número e texto brasileiro", () => {
    expect(parseMoney(1234.5)).toBe(1234.5);
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});
