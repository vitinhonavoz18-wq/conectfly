import { describe, expect, it } from "vitest";
import {
  generatePredictions,
  sanitizeHistory,
  computeStats,
  validateNumberSet,
  DEFAULT_GAMES,
  PREDICTION_METHOD,
} from "../src/index.ts";
import { game } from "./helpers.ts";

function syntheticHistory(slug: string, size: number) {
  const g = game(slug);
  const out = [];
  let x = 7;
  for (let c = 1; c <= size; c++) {
    const set = new Set<number>();
    while (set.size < g.numbersDrawn) {
      x = (x * 1103515245 + 12345) % 2147483648;
      set.add(g.minNumber + (x % (g.maxNumber - g.minNumber + 1)));
    }
    out.push({ contest: c, numbers: [...set].sort((a, b) => a - b) });
  }
  return out;
}

describe("generatePredictions", () => {
  it.each(Object.keys(DEFAULT_GAMES))(
    "%s: quantidade, intervalo, ordem, tipos e sem duplicatas",
    (slug) => {
      const g = game(slug);
      const result = generatePredictions(g, syntheticHistory(slug, 60), {
        count: 5,
        seed: "teste",
      });
      expect(result.method).toBe(PREDICTION_METHOD);
      expect(result.predictions).toHaveLength(5);
      for (const p of result.predictions) {
        expect(p.numbers).toHaveLength(g.numbersPerBet);
        expect(new Set(p.numbers).size).toBe(p.numbers.length);
        expect(
          p.numbers.every((n) => Number.isInteger(n) && n >= g.minNumber && n <= g.maxNumber),
        ).toBe(true);
        expect([...p.numbers].sort((a, b) => a - b)).toEqual(p.numbers);
        expect(validateNumberSet(p.numbers, g, "bet").ok).toBe(true);
      }
      const keys = result.predictions.map((p) => p.numbers.join(","));
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  it("é determinístico com a mesma semente e muda com outra semente", () => {
    const g = game("megasena");
    const h = syntheticHistory("megasena", 40);
    const a = generatePredictions(g, h, { count: 3, seed: "megasena:3066" });
    const b = generatePredictions(g, h, { count: 3, seed: "megasena:3066" });
    const c = generatePredictions(g, h, { count: 3, seed: "megasena:3067" });
    expect(a.predictions.map((p) => p.numbers)).toEqual(b.predictions.map((p) => p.numbers));
    expect(a.predictions.map((p) => p.numbers)).not.toEqual(c.predictions.map((p) => p.numbers));
  });

  it("funciona com histórico vazio", () => {
    const r = generatePredictions(game("quina"), [], { count: 2, seed: "vazio" });
    expect(r.history_size).toBe(0);
    expect(r.predictions).toHaveLength(2);
  });

  it("ignora registros incompletos/inválidos do histórico", () => {
    const g = game("megasena");
    const dirty = [
      { contest: 1, numbers: [1, 2, 3, 4, 5, 6] },
      { contest: 2, numbers: [1, 2, 3] },
      { contest: "3", numbers: [1, 2, 3, 4, 5, 6] },
      { numbers: [1, 2, 3, 4, 5, 6] },
      null,
      { contest: 4, numbers: [1, 1, 3, 4, 5, 6] },
      { contest: 5, numbers: [1, 2, 3, 4, 5, 70] },
    ];
    expect(sanitizeHistory(dirty, g)).toHaveLength(1);
    expect(generatePredictions(g, dirty as never, { count: 1, seed: "x" }).history_size).toBe(1);
  });

  it("rejeita entrada inválida", () => {
    const g = game("megasena");
    expect(() => generatePredictions(g, [], { count: 0, seed: "x" })).toThrow();
    expect(() => generatePredictions(g, [], { count: 51, seed: "x" })).toThrow();
    expect(() => generatePredictions(g, [], { count: 1, seed: "" })).toThrow();
    expect(() =>
      generatePredictions({ ...g, maxNumber: 0 }, [], { count: 1, seed: "x" }),
    ).toThrow();
    expect(() =>
      generatePredictions({ ...g, numbersPerBet: 99 }, [], { count: 1, seed: "x" }),
    ).toThrow();
  });

  it("estatísticas descritivas: frequência, atraso e médias", () => {
    const g = game("megasena");
    const stats = computeStats(
      [
        { contest: 2, numbers: [1, 2, 3, 4, 5, 6] },
        { contest: 1, numbers: [1, 10, 20, 30, 40, 50] },
      ],
      g,
    );
    expect(stats.sampleSize).toBe(2);
    expect(stats.frequency[1]).toBe(2);
    expect(stats.frequency[60]).toBe(0);
    expect(stats.delay[1]).toBe(0);
    expect(stats.delay[10]).toBe(1);
    expect(stats.delay[60]).toBe(2);
    expect(stats.averages.repeatsFromPrevious).toBe(1);
  });
});
