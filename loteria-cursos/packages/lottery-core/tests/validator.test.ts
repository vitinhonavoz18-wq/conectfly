import { describe, expect, it } from "vitest";
import { validateNumberSet, validateNormalizedDraw, isIsoDay } from "../src/index.ts";
import { game } from "./helpers.ts";

const mega = game("megasena");

describe("validateNumberSet", () => {
  it("aceita seis dezenas válidas e ordenadas da Mega-Sena", () => {
    expect(validateNumberSet([4, 17, 28, 39, 44, 57], mega, "draw").ok).toBe(true);
  });
  it.each([
    ["quantidade errada", [4, 17, 28, 39, 44], "WRONG_COUNT"],
    ["dezena repetida", [4, 4, 28, 39, 44, 57], "DUPLICATE"],
    ["fora do intervalo (61)", [4, 17, 28, 39, 44, 61], "OUT_OF_RANGE"],
    ["zero na Mega-Sena", [0, 17, 28, 39, 44, 57], "OUT_OF_RANGE"],
    ["texto em vez de número", ["04", 17, 28, 39, 44, 57], "NOT_INTEGER"],
    ["decimal", [4.5, 17, 28, 39, 44, 57], "NOT_INTEGER"],
    ["fora de ordem", [17, 4, 28, 39, 44, 57], "NOT_SORTED"],
  ])("rejeita %s", (_label, numbers, code) => {
    const r = validateNumberSet(numbers, mega, "draw");
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain(code);
  });
  it("rejeita entrada que não é lista", () => {
    expect(validateNumberSet("4,17", mega, "draw").issues[0]?.code).toBe("NOT_AN_ARRAY");
    expect(validateNumberSet(null, mega, "bet").ok).toBe(false);
  });
  it("Lotomania: aposta tem 50 dezenas e o sorteio 20, aceitando 00", () => {
    const lm = game("lotomania");
    const draw = [0, 3, 11, 12, 21, 23, 34, 45, 47, 56, 59, 61, 67, 72, 78, 84, 88, 90, 95, 99];
    expect(validateNumberSet(draw, lm, "draw").ok).toBe(true);
    expect(validateNumberSet(draw, lm, "bet").ok).toBe(false);
    expect(
      validateNumberSet(
        Array.from({ length: 50 }, (_, i) => i * 2),
        lm,
        "bet",
      ).ok,
    ).toBe(true);
  });
});

describe("validateNormalizedDraw", () => {
  const base = {
    game: "megasena",
    contest: 3065,
    draw_day: "2026-10-01",
    numbers: [4, 17, 28, 39, 44, 57],
    draw_order: [39, 4, 57, 17, 44, 28],
    accumulated: true,
    estimated_prize: 45000000,
    next_draw_day: "2026-10-04",
    next_contest: 3066,
  };
  it("aceita resultado consistente", () => {
    expect(validateNormalizedDraw(base, mega, { today: "2026-10-02" }).ok).toBe(true);
  });
  it.each([
    ["concurso zero", { contest: 0 }, "INVALID_CONTEST"],
    ["ordem do sorteio divergente", { draw_order: [39, 4, 57, 17, 44, 29] }, "DRAW_ORDER_MISMATCH"],
    ["data no futuro", { draw_day: "2026-10-05", next_draw_day: "2026-10-08" }, "DATE_IN_FUTURE"],
    ["próximo concurso errado", { next_contest: 3070 }, "NEXT_CONTEST_MISMATCH"],
    ["próxima data antes do sorteio", { next_draw_day: "2026-09-30" }, "NEXT_DATE_NOT_AFTER"],
    ["outra modalidade", { game: "quina" }, "GAME_MISMATCH"],
    ["prêmio negativo", { estimated_prize: -1 }, "INVALID_PRIZE"],
  ])("rejeita %s", (_l, patch, code) => {
    const r = validateNormalizedDraw({ ...base, ...patch }, mega, { today: "2026-10-02" });
    expect(r.issues.map((i) => i.code)).toContain(code);
  });
  it("isIsoDay recusa datas impossíveis", () => {
    expect(isIsoDay("2026-02-31")).toBe(false);
    expect(isIsoDay("2026-02-28")).toBe(true);
    expect(isIsoDay("28/02/2026")).toBe(false);
  });
});
