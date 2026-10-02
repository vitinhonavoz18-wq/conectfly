import type { GameRules } from "./games.ts";

export interface HistoryDraw {
  contest: number;
  numbers: number[];
}

export interface NumberStats {
  sampleSize: number;
  frequency: Record<number, number>;
  recentFrequency: Record<number, number>;
  /** Concursos desde a última vez que a dezena saiu (sampleSize se nunca saiu na amostra). */
  delay: Record<number, number>;
  averages: {
    evenCount: number;
    sum: number;
    repeatsFromPrevious: number;
    consecutivePairs: number;
    dispersion: number;
    rangeDistribution: number[];
  };
}

export const RECENT_WINDOW = 10;

export function rangeBuckets(rules: GameRules): Array<[number, number]> {
  // Faixas de 10 em 10 (01–10, 11–20…), ajustadas ao intervalo da modalidade.
  const buckets: Array<[number, number]> = [];
  const start = rules.minNumber;
  for (let lo = start; lo <= rules.maxNumber; lo += 10) {
    buckets.push([lo, Math.min(lo + 9, rules.maxNumber)]);
  }
  return buckets;
}

export function profileOf(numbers: number[], rules: GameRules, previous?: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const even = sorted.filter((n) => n % 2 === 0).length;
  const sum = sorted.reduce((s, n) => s + n, 0);
  let consecutivePairs = 0;
  let maxRun = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === (sorted[i - 1] as number) + 1) {
      consecutivePairs++;
      run++;
      maxRun = Math.max(maxRun, run);
    } else run = 1;
  }
  const mean = sum / sorted.length;
  const dispersion = Math.sqrt(sorted.reduce((s, n) => s + (n - mean) ** 2, 0) / sorted.length);
  const ranges = rangeBuckets(rules).map(
    ([lo, hi]) => sorted.filter((n) => n >= lo && n <= hi).length,
  );
  const prevSet = new Set(previous ?? []);
  const repeats = previous ? sorted.filter((n) => prevSet.has(n)).length : 0;
  return {
    even,
    odd: sorted.length - even,
    sum,
    consecutivePairs,
    maxRun,
    dispersion,
    ranges,
    repeatsFromPrevious: repeats,
  };
}

/** Estatísticas descritivas do histórico. Servem para MONTAR palpites diversos — não preveem nada. */
export function computeStats(history: HistoryDraw[], rules: GameRules): NumberStats {
  const ordered = [...history].sort((a, b) => b.contest - a.contest); // mais recente primeiro
  const universe: number[] = [];
  for (let n = rules.minNumber; n <= rules.maxNumber; n++) universe.push(n);
  const frequency: Record<number, number> = {};
  const recentFrequency: Record<number, number> = {};
  const delay: Record<number, number> = {};
  for (const n of universe) {
    frequency[n] = 0;
    recentFrequency[n] = 0;
    delay[n] = ordered.length;
  }
  ordered.forEach((draw, idx) => {
    for (const n of draw.numbers) {
      if (!(n in frequency)) continue;
      frequency[n] = (frequency[n] ?? 0) + 1;
      if (idx < RECENT_WINDOW) recentFrequency[n] = (recentFrequency[n] ?? 0) + 1;
      if ((delay[n] ?? ordered.length) === ordered.length) delay[n] = idx;
    }
  });

  const profiles = ordered.map((d, i) => profileOf(d.numbers, rules, ordered[i + 1]?.numbers));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const buckets = rangeBuckets(rules).length;
  return {
    sampleSize: ordered.length,
    frequency,
    recentFrequency,
    delay,
    averages: {
      evenCount: avg(profiles.map((p) => p.even)),
      sum: avg(profiles.map((p) => p.sum)),
      repeatsFromPrevious: avg(profiles.slice(0, -1).map((p) => p.repeatsFromPrevious)),
      consecutivePairs: avg(profiles.map((p) => p.consecutivePairs)),
      dispersion: avg(profiles.map((p) => p.dispersion)),
      rangeDistribution: Array.from({ length: buckets }, (_, b) =>
        avg(profiles.map((p) => p.ranges[b] ?? 0)),
      ),
    },
  };
}
