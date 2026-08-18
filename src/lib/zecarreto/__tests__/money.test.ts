import { describe, expect, test } from "bun:test";
import {
  clampPositive,
  formatBRL,
  pctOf,
  roundToStep,
  splitCommission,
  sumCents,
} from "../domain/money";

describe("dinheiro em centavos", () => {
  test("percentual arredonda corretamente", () => {
    expect(pctOf(10_000, 35)).toBe(3_500);
    expect(pctOf(3_333, 20)).toBe(667); // 666,6 -> 667
    expect(pctOf(0, 35)).toBe(0);
  });

  test("comissão e líquido sempre somam o total", () => {
    for (const total of [1, 999, 3_333, 10_000, 123_457]) {
      const { platformFeeCents, driverNetCents } = splitCommission(total, 20);
      expect(platformFeeCents + driverNetCents).toBe(total);
      expect(driverNetCents).toBeGreaterThanOrEqual(0);
    }
  });

  test("comissão nunca passa do total", () => {
    const { platformFeeCents, driverNetCents } = splitCommission(1_000, 100);
    expect(platformFeeCents).toBe(1_000);
    expect(driverNetCents).toBe(0);
  });

  test("arredondamento por passo", () => {
    expect(roundToStep(1_037, 50)).toBe(1_050);
    expect(roundToStep(1_010, 50)).toBe(1_000);
    expect(roundToStep(1_037, 0)).toBe(1_037);
  });

  test("nunca devolve valor negativo", () => {
    expect(clampPositive(-500)).toBe(0);
    expect(sumCents(100, -50)).toBe(50);
  });

  test("formata em reais", () => {
    // O Intl usa espaço fino (não quebrável) entre "R$" e o número.
    expect(formatBRL(1_055).replace(/\u00A0/g, " ")).toBe("R$ 10,55");
  });
});
