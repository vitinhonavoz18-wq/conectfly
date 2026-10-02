/**
 * Retry com backoff exponencial + jitter.
 *
 * Exemplo do dia a dia: se o motoboy não encontra o cliente, ele não fica
 * tocando a campainha sem parar. Espera 5s, depois 15s, depois 45s… e desiste
 * depois de algumas tentativas. O "jitter" é uma pequena variação aleatória
 * no tempo para que vários motoboys não toquem todos no mesmo segundo.
 */

export interface BackoffPolicy {
  /** Espera da primeira repetição, em ms. */
  baseMs: number;
  /** Multiplicador a cada tentativa (3 → 5s, 15s, 45s…). */
  factor: number;
  /** Teto da espera, em ms. */
  maxMs: number;
  /** Variação aleatória proporcional (0.2 = ±20%). */
  jitterRatio: number;
  /** Número máximo de tentativas (incluindo a primeira). */
  maxAttempts: number;
}

export const DEFAULT_BACKOFF: BackoffPolicy = {
  baseMs: 5_000,
  factor: 3,
  maxMs: 120_000,
  jitterRatio: 0.2,
  maxAttempts: 5,
};

/**
 * Espera antes da próxima tentativa. `attempt` é o número da tentativa que
 * acabou de falhar (1 = primeira). Com a política padrão e sem jitter:
 * 1→5s, 2→15s, 3→45s, 4→120s (teto).
 */
export function computeBackoffMs(
  attempt: number,
  policy: Pick<BackoffPolicy, "baseMs" | "factor" | "maxMs" | "jitterRatio">,
  random: () => number = Math.random,
): number {
  if (!Number.isFinite(attempt) || attempt < 1) throw new RangeError("attempt must be >= 1");
  const raw = Math.min(policy.baseMs * Math.pow(policy.factor, attempt - 1), policy.maxMs);
  const jitter = policy.jitterRatio > 0 ? (random() * 2 - 1) * policy.jitterRatio * raw : 0;
  return Math.max(0, Math.round(raw + jitter));
}

export class RetryableError extends Error {
  readonly retryable = true;
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

export class PermanentError extends Error {
  readonly retryable = false;
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PermanentError";
  }
}

export interface RetryOptions {
  policy?: Partial<BackoffPolicy>;
  isRetryable?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof PermanentError) return false;
  if (error instanceof RetryableError) return true;
  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean((error as { retryable: unknown }).retryable);
  }
  // Erros de rede/timeout do fetch nativo.
  if (error instanceof Error) {
    return (
      error.name === "AbortError" || error.name === "TimeoutError" || error.name === "TypeError"
    );
  }
  return false;
}

/** Executa `fn` repetindo apenas erros transitórios, sem loop infinito. */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const policy = { ...DEFAULT_BACKOFF, ...options.policy };
  const isRetryable = options.isRetryable ?? defaultIsRetryable;
  const doSleep = options.sleep ?? sleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt >= policy.maxAttempts) throw error;
      const hinted = error instanceof RetryableError ? error.retryAfterMs : undefined;
      const delayMs = hinted ?? computeBackoffMs(attempt, policy, options.random);
      options.onRetry?.({ attempt, delayMs, error });
      await doSleep(delayMs);
    }
  }
  throw lastError;
}

/** Interpreta o cabeçalho Retry-After (segundos ou data HTTP). */
export function parseRetryAfter(
  value: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - now);
  return undefined;
}
