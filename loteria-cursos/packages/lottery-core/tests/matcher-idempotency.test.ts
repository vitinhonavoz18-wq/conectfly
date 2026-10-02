import { describe, expect, it } from "vitest";
import {
  matchPrediction,
  buildIdempotencyKey,
  parseIdempotencyKey,
  canTransition,
  assertTransition,
  POST_STATUSES,
  TERMINAL_STATUSES,
} from "../src/index.ts";
import { game } from "./helpers.ts";

describe("matchPrediction", () => {
  it("exemplo do enunciado: 3 coincidências", () => {
    expect(
      matchPrediction([4, 17, 28, 39, 44, 57], [4, 10, 28, 39, 51, 60], game("megasena")),
    ).toEqual({
      hits: 3,
      matching_numbers: [4, 28, 39],
    });
  });
  it("zero coincidências", () => {
    expect(matchPrediction([1, 2, 3, 4, 5], [6, 7, 8, 9, 10], game("quina")).hits).toBe(0);
  });
  it("Lotomania: palpite de 50 contra 20 sorteadas", () => {
    const pred = Array.from({ length: 50 }, (_, i) => i * 2);
    const draw = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39];
    expect(matchPrediction(pred, draw, game("lotomania"))).toEqual({
      hits: 10,
      matching_numbers: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],
    });
  });
  it("recusa entrada inválida", () => {
    expect(() =>
      matchPrediction([1, 1, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], game("megasena")),
    ).toThrow();
    expect(() => matchPrediction(["1"] as never, [1])).toThrow();
  });
});

describe("chave de idempotência", () => {
  it("formato do enunciado", () => {
    expect(
      buildIdempotencyKey({
        contentType: "RESULT",
        game: "megasena",
        contest: 3065,
        format: "feed",
      }),
    ).toBe("result:megasena:3065:feed");
  });
  it("dry-run e variante geram chaves distintas e reversíveis", () => {
    const k = buildIdempotencyKey({
      contentType: "PREDICTION",
      game: "lotofacil",
      contest: 10,
      format: "story",
      variant: 2,
      dryRun: true,
    });
    expect(k).toBe("prediction:lotofacil:10:story:v2:dryrun");
    expect(parseIdempotencyKey(k)).toEqual({
      contentType: "PREDICTION",
      game: "lotofacil",
      contest: 10,
      format: "story",
      variant: 2,
      dryRun: true,
    });
  });
  it.each([
    [{ contentType: "RESULT", game: "Mega Sena", contest: 1, format: "feed" }],
    [{ contentType: "RESULT", game: "megasena", contest: 0, format: "feed" }],
    [{ contentType: "RESULT", game: "megasena", contest: 1.5, format: "feed" }],
    [{ contentType: "RESULT", game: "megasena", contest: 1, format: "tiktok" }],
    [{ contentType: "result;drop", game: "megasena", contest: 1, format: "feed" }],
  ])("recusa entrada inválida %#", (input) => {
    expect(() => buildIdempotencyKey(input as never)).toThrow();
  });
  it("mesma entrada ⇒ mesma chave", () => {
    const i = { contentType: "CHECK", game: "quina", contest: 6870, format: "feed" as const };
    expect(buildIdempotencyKey(i)).toBe(buildIdempotencyKey({ ...i }));
  });
});

describe("máquina de estados dos posts", () => {
  it("fluxo feliz é permitido", () => {
    const path = ["DRAFT", "READY", "RENDERING", "RENDERED", "PUBLISHING", "PUBLISHED"] as const;
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1]!, path[i]!)).toBe(true);
  });
  it("PUBLISHED nunca volta a publicar", () => {
    for (const to of POST_STATUSES) expect(canTransition("PUBLISHED", to)).toBe(false);
    expect(() => assertTransition("PUBLISHED", "PUBLISHING")).toThrow(/INVALID_POST_TRANSITION/);
  });
  it("qualquer estado operacional pode ir para FAILED; terminais não", () => {
    for (const s of ["DRAFT", "READY", "RENDERING", "RENDERED", "PUBLISHING"] as const)
      expect(canTransition(s, "FAILED")).toBe(true);
    for (const s of TERMINAL_STATUSES) expect(canTransition(s, "FAILED")).toBe(false);
  });
  it("não pula etapas", () => {
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(false);
    expect(canTransition("READY", "PUBLISHING")).toBe(false);
  });
});
