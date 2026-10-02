import { CaixaSourceAdapter, type CaixaAdapterOptions } from "./caixa.ts";
import type { LotterySourceAdapter } from "./types.ts";

export * from "./types.ts";
export * from "./caixa.ts";

/** Fábrica de fontes. Nova fonte = novo `case` aqui (ver docs/LOTTERY_SOURCE.md). */
export function createSourceAdapter(
  name: string,
  options: CaixaAdapterOptions = {},
): LotterySourceAdapter {
  switch (name) {
    case "caixa":
      return new CaixaSourceAdapter(options);
    default:
      throw new Error(`Fonte de resultados desconhecida: ${name}`);
  }
}
