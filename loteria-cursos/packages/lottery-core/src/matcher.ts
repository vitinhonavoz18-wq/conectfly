import type { GameRules } from "./games.ts";
import { validateNumberSet } from "./validator.ts";

export interface MatchResult {
  hits: number;
  matching_numbers: number[];
}

/**
 * Conferência determinística: interseção entre palpite e resultado oficial.
 * Nenhum LLM participa. "Coincidência" não é "prêmio" — a faixa de premiação
 * oficial depende das regras da CAIXA e não é inferida aqui.
 */
export function matchPrediction(
  prediction: number[],
  result: number[],
  rules?: GameRules,
): MatchResult {
  if (rules) {
    const p = validateNumberSet(prediction, rules, "bet", "prediction");
    const r = validateNumberSet(result, rules, "draw", "result");
    if (!p.ok || !r.ok) {
      throw new Error(
        `entrada inválida para conferência: ${JSON.stringify([...p.issues, ...r.issues])}`,
      );
    }
  } else {
    for (const arr of [prediction, result]) {
      if (!Array.isArray(arr) || arr.some((n) => typeof n !== "number" || !Number.isInteger(n))) {
        throw new Error("palpite e resultado devem ser listas de inteiros");
      }
      if (new Set(arr).size !== arr.length) throw new Error("lista com dezena repetida");
    }
  }
  const resultSet = new Set(result);
  const matching = prediction.filter((n) => resultSet.has(n)).sort((a, b) => a - b);
  return { hits: matching.length, matching_numbers: matching };
}
