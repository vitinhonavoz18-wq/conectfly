import { assertValidRules, type GameRules } from "./games.ts";
import { seededRandom } from "./random.ts";
import {
  computeStats,
  profileOf,
  rangeBuckets,
  type HistoryDraw,
  type NumberStats,
} from "./stats.ts";
import { validateNumberSet } from "./validator.ts";

export const PREDICTION_METHOD = "statistical_diversification_v1";
export const ALGORITHM_VERSION = "1.0.0";

export interface GenerateOptions {
  /** Quantos palpites finais. */
  count: number;
  /** Semente — mesma semente + mesmo histórico ⇒ mesmo resultado. */
  seed: string;
  /** Candidatos gerados antes da seleção (padrão 300). */
  candidatePool?: number;
}

export interface GeneratedPrediction {
  numbers: number[];
  score: number;
  metrics: ReturnType<typeof profileOf>;
}

export interface GenerationResult {
  game: string;
  method: string;
  algorithm_version: string;
  seed: string;
  history_size: number;
  predictions: GeneratedPrediction[];
  disclaimer: string;
}

export const GENERATOR_DISCLAIMER =
  "Combinação criada a partir de critérios estatísticos descritivos para diversificar escolhas. " +
  "Não aumenta a probabilidade de acerto: em uma loteria justa todas as combinações têm a mesma chance.";

/**
 * Gera palpites válidos por construção:
 *  1. pesos suaves por dezena (frequência geral/recente e atraso), limitados a [0,6 ; 1,4];
 *  2. sorteio ponderado SEM reposição → nunca repete dezena, sempre no intervalo;
 *  3. pontuação de "perfil típico" (pares/ímpares, soma, faixas, sequências) contra o
 *     esperado matematicamente para uma escolha uniforme — não contra "dezenas quentes";
 *  4. seleção diversificada (maximiza a diferença entre os palpites escolhidos);
 *  5. validação determinística final de cada palpite.
 */
export function generatePredictions(
  rules: GameRules,
  history: HistoryDraw[],
  options: GenerateOptions,
): GenerationResult {
  assertValidRules(rules);
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 50) {
    throw new RangeError("count deve ser inteiro entre 1 e 50");
  }
  if (typeof options.seed !== "string" || options.seed.length === 0)
    throw new Error("seed obrigatória");
  const cleanHistory = sanitizeHistory(history, rules);
  const stats = computeStats(cleanHistory, rules);
  const random = seededRandom(`${options.seed}|${rules.slug}|${ALGORITHM_VERSION}`);
  const weights = numberWeights(rules, stats);
  const previous = [...cleanHistory].sort((a, b) => b.contest - a.contest)[0]?.numbers;

  const pool = Math.max(options.count * 20, options.candidatePool ?? 300);
  const seen = new Set<string>();
  const candidates: GeneratedPrediction[] = [];
  let guard = 0;
  while (candidates.length < pool && guard < pool * 5) {
    guard++;
    const numbers = weightedSample(weights, rules.numbersPerBet, random);
    const key = numbers.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const metrics = profileOf(numbers, rules, previous);
    candidates.push({ numbers, metrics, score: profilePenalty(metrics, rules) });
  }
  candidates.sort(
    (a, b) => a.score - b.score || a.numbers.join(",").localeCompare(b.numbers.join(",")),
  );

  const selected = diversify(candidates, options.count);
  for (const p of selected) {
    const check = validateNumberSet(p.numbers, rules, "bet");
    if (!check.ok)
      throw new Error(`gerador produziu palpite inválido: ${JSON.stringify(check.issues)}`);
  }
  return {
    game: rules.slug,
    method: PREDICTION_METHOD,
    algorithm_version: ALGORITHM_VERSION,
    seed: options.seed,
    history_size: stats.sampleSize,
    predictions: selected.map((p) => ({ ...p, score: Math.round(p.score * 1000) / 1000 })),
    disclaimer: GENERATOR_DISCLAIMER,
  };
}

/** Remove do histórico registros incompletos/inválidos em vez de quebrar. */
export function sanitizeHistory(history: unknown, rules: GameRules): HistoryDraw[] {
  if (!Array.isArray(history)) return [];
  const out: HistoryDraw[] = [];
  for (const item of history) {
    if (!item || typeof item !== "object") continue;
    const { contest, numbers } = item as { contest?: unknown; numbers?: unknown };
    if (typeof contest !== "number" || !Number.isInteger(contest) || contest < 1) continue;
    if (!validateNumberSet(numbers, rules, "draw").ok) continue;
    out.push({ contest, numbers: numbers as number[] });
  }
  return out;
}

function numberWeights(rules: GameRules, stats: NumberStats): Map<number, number> {
  const weights = new Map<number, number>();
  const nums: number[] = [];
  for (let n = rules.minNumber; n <= rules.maxNumber; n++) nums.push(n);
  if (stats.sampleSize === 0) {
    nums.forEach((n) => weights.set(n, 1));
    return weights;
  }
  const mean = (rec: Record<number, number>) =>
    nums.reduce((s, n) => s + (rec[n] ?? 0), 0) / nums.length || 1;
  const mf = mean(stats.frequency);
  const mr = mean(stats.recentFrequency) || 1;
  const md = mean(stats.delay) || 1;
  for (const n of nums) {
    const f = (stats.frequency[n] ?? 0) / mf - 1;
    const r = (stats.recentFrequency[n] ?? 0) / mr - 1;
    const d = (stats.delay[n] ?? 0) / md - 1;
    const w = 1 + 0.15 * f + 0.1 * r + 0.1 * d;
    weights.set(n, Math.min(1.4, Math.max(0.6, w)));
  }
  return weights;
}

function weightedSample(weights: Map<number, number>, k: number, random: () => number): number[] {
  const pool = [...weights.entries()];
  const picked: number[] = [];
  for (let i = 0; i < k; i++) {
    const total = pool.reduce((s, [, w]) => s + w, 0);
    let r = random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= (pool[idx] as [number, number])[1];
      if (r <= 0) break;
    }
    picked.push((pool[idx] as [number, number])[0]);
    pool.splice(idx, 1);
  }
  return picked.sort((a, b) => a - b);
}

/** Penalidade de "perfil atípico" comparando com o esperado de uma escolha uniforme. */
function profilePenalty(m: ReturnType<typeof profileOf>, rules: GameRules): number {
  const k = rules.numbersPerBet;
  const N = rules.maxNumber - rules.minNumber + 1;
  let evens = 0;
  for (let n = rules.minNumber; n <= rules.maxNumber; n++) if (n % 2 === 0) evens++;
  const expectedEven = (k * evens) / N;
  const mean = (rules.minNumber + rules.maxNumber) / 2;
  const variance = ((N * N - 1) / 12) * ((N - k) / Math.max(1, N - 1));
  const sumStd = Math.sqrt(k * variance) || 1;
  const expectedSum = k * mean;
  const buckets = rangeBuckets(rules);
  const bucketPenalty = buckets.reduce((s, [lo, hi], i) => {
    const expected = (k * (hi - lo + 1)) / N;
    return s + Math.abs((m.ranges[i] ?? 0) - expected) / Math.max(1, expected);
  }, 0);
  const expectedRun = k > N / 2 ? Math.ceil(k / 4) : 2;
  return (
    Math.abs(m.even - expectedEven) / Math.max(1, Math.sqrt(k)) +
    Math.abs(m.sum - expectedSum) / sumStd +
    bucketPenalty / buckets.length +
    Math.max(0, m.maxRun - expectedRun) * 0.5
  );
}

function jaccard(a: number[], b: number[]): number {
  const sa = new Set(a);
  const inter = b.filter((n) => sa.has(n)).length;
  return inter / (a.length + b.length - inter);
}

/** Escolhe os melhores perfis garantindo que os palpites sejam diferentes entre si. */
function diversify(candidates: GeneratedPrediction[], count: number): GeneratedPrediction[] {
  if (candidates.length === 0) return [];
  const shortlist = candidates.slice(0, Math.max(count * 10, 30));
  const selected: GeneratedPrediction[] = [shortlist[0] as GeneratedPrediction];
  while (selected.length < count && selected.length < shortlist.length) {
    let best: GeneratedPrediction | undefined;
    let bestValue = -Infinity;
    for (const c of shortlist) {
      if (selected.includes(c)) continue;
      const minDistance = Math.min(...selected.map((s) => 1 - jaccard(s.numbers, c.numbers)));
      const value = minDistance - 0.1 * c.score;
      if (value > bestValue) {
        bestValue = value;
        best = c;
      }
    }
    if (!best) break;
    selected.push(best);
  }
  return selected;
}
