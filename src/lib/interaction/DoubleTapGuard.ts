/**
 * DoubleTapGuard — central debouncer for "single fire" actions.
 *
 * Use when an action MUST NOT be triggered twice from a single intent
 * (Checkout, Close Table, QR scan, Add to cart). Repeated counter
 * controls (quantity +/-) should NOT use this guard; pass a unique key
 * per logical action to keep them independent.
 *
 * Implementation: per-key timestamp window. Two calls within `windowMs`
 * for the same key resolve to a single execution.
 */

const lastFiredAt = new Map<string, number>();
const DEFAULT_WINDOW_MS = 450;

export interface GuardOptions {
  windowMs?: number;
  /** When true the second call resets the window timer. */
  refreshOnRepeat?: boolean;
}

export function shouldFire(key: string, opts: GuardOptions = {}): boolean {
  const now = performance.now();
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const prev = lastFiredAt.get(key) ?? 0;
  if (now - prev < windowMs) {
    if (opts.refreshOnRepeat) lastFiredAt.set(key, now);
    return false;
  }
  lastFiredAt.set(key, now);
  return true;
}

export function guard<TArgs extends unknown[], TReturn>(
  key: string,
  fn: (...args: TArgs) => TReturn,
  opts?: GuardOptions,
): (...args: TArgs) => TReturn | undefined {
  return (...args: TArgs) => {
    if (!shouldFire(key, opts)) return undefined;
    return fn(...args);
  };
}

export function resetGuard(key?: string) {
  if (key) lastFiredAt.delete(key);
  else lastFiredAt.clear();
}