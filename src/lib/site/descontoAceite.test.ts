import { describe, it, expect } from "vitest";
import {
  normalizeDescontoAceite,
  descontoAceiteOf,
  valorDoDescontoAceite,
  DESCONTO_ACEITE_MAXIMO,
} from "./descontoAceite";

describe("desconto por aceitar ofertas — leitura da configuração", () => {
  it("sem configuração, o desconto é zero", () => {
    for (const nada of [undefined, null, "", "  ", "abc", 0, -5, NaN]) {
      expect(normalizeDescontoAceite(nada)).toBe(0);
    }
  });

  it("aceita número e texto com vírgula", () => {
    expect(normalizeDescontoAceite(10)).toBe(10);
    expect(normalizeDescontoAceite("10")).toBe(10);
    expect(normalizeDescontoAceite("7,5")).toBe(7.5);
  });

  it("um zero digitado a mais não faz a loja vender de graça", () => {
    // "100" no lugar de "10" é o erro mais fácil de cometer.
    expect(normalizeDescontoAceite(100)).toBe(DESCONTO_ACEITE_MAXIMO);
    expect(normalizeDescontoAceite(999)).toBe(DESCONTO_ACEITE_MAXIMO);
  });

  it("arredonda para o meio por cento mais próximo", () => {
    expect(normalizeDescontoAceite(10.2)).toBe(10);
    expect(normalizeDescontoAceite(10.3)).toBe(10.5);
  });

  it("lê da loja sem quebrar quando o campo não existe", () => {
    expect(descontoAceiteOf(undefined)).toBe(0);
    expect(descontoAceiteOf({})).toBe(0);
    expect(descontoAceiteOf({ site_settings: null })).toBe(0);
    expect(descontoAceiteOf({ site_settings: { outra_coisa: 1 } })).toBe(0);
    expect(descontoAceiteOf({ site_settings: { marketing_opt_in_discount_percent: 15 } })).toBe(15);
  });
});

describe("desconto por aceitar ofertas — a conta", () => {
  it("10% de R$ 100 é R$ 10", () => {
    expect(valorDoDescontoAceite(100, 10)).toBe(10);
  });

  it("arredonda para baixo, no centavo", () => {
    // 10% de 33,33 = 3,333 → 3,33 (nunca 3,34)
    expect(valorDoDescontoAceite(33.33, 10)).toBe(3.33);
    // 7,5% de 19,99 = 1,49925 → 1,49
    expect(valorDoDescontoAceite(19.99, 7.5)).toBe(1.49);
  });

  it("sem percentual, sem desconto", () => {
    expect(valorDoDescontoAceite(100, 0)).toBe(0);
    expect(valorDoDescontoAceite(100, -10)).toBe(0);
  });

  it("carrinho vazio ou valor estranho não vira desconto", () => {
    expect(valorDoDescontoAceite(0, 10)).toBe(0);
    expect(valorDoDescontoAceite(-50, 10)).toBe(0);
    expect(valorDoDescontoAceite(NaN, 10)).toBe(0);
  });

  it("o desconto nunca passa da metade da conta", () => {
    // Mesmo pedindo 90%, o teto segura em 50%.
    expect(valorDoDescontoAceite(100, 90)).toBe(50);
  });

  it("o total nunca fica negativo, nem com o teto", () => {
    const subtotal = 40;
    const desconto = valorDoDescontoAceite(subtotal, 50);
    expect(subtotal - desconto).toBeGreaterThan(0);
  });
});
