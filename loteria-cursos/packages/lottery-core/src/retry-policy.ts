import { computeBackoffMs } from "@lc/shared";

/**
 * Espera entre consultas de resultado (polling). Não existe loop infinito:
 * passou de maxAttempts, para e registra RESULT_NOT_AVAILABLE.
 * intervalo base × 1,5^(tentativa−1), com teto de 4× o intervalo e jitter de ±10%.
 */
export function decideResultPoll(input: {
  attempt: number;
  maxAttempts: number;
  intervalSeconds: number;
  random?: () => number;
}) {
  const { attempt, maxAttempts, intervalSeconds } = input;
  if (!Number.isInteger(attempt) || attempt < 1) throw new RangeError("attempt inválido");
  if (attempt >= maxAttempts) {
    return {
      outcome: "stop" as const,
      delay_seconds: 0,
      attempt,
      reason: `RESULT_NOT_AVAILABLE após ${attempt} tentativas`,
    };
  }
  const ms = computeBackoffMs(
    attempt,
    {
      baseMs: intervalSeconds * 1000,
      factor: 1.5,
      maxMs: intervalSeconds * 4000,
      jitterRatio: 0.1,
    },
    input.random,
  );
  return {
    outcome: "retry" as const,
    delay_seconds: Math.max(1, Math.round(ms / 1000)),
    attempt,
    reason: "novo concurso ainda não publicado",
  };
}
