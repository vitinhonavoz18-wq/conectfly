import type { GameRules } from "./games.ts";

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export type ValidationResult = { ok: true; issues: [] } | { ok: false; issues: ValidationIssue[] };

const ok = (): ValidationResult => ({ ok: true, issues: [] });
const fail = (issues: ValidationIssue[]): ValidationResult => ({ ok: false, issues });

/**
 * Valida um conjunto de dezenas contra as regras da modalidade.
 * kind = "draw" → quantidade sorteada pela CAIXA; "bet" → quantidade da aposta.
 * Exige: array, inteiros de verdade (nada de "04" em texto), dentro do intervalo,
 * sem repetição, quantidade exata e ordem crescente.
 */
export function validateNumberSet(
  numbers: unknown,
  rules: GameRules,
  kind: "draw" | "bet",
  path = "numbers",
): ValidationResult {
  if (!Array.isArray(numbers)) {
    return fail([{ code: "NOT_AN_ARRAY", message: "dezenas devem ser uma lista", path }]);
  }
  const issues: ValidationIssue[] = [];
  const expected = kind === "draw" ? rules.numbersDrawn : rules.numbersPerBet;
  if (numbers.length !== expected) {
    issues.push({
      code: "WRONG_COUNT",
      message: `esperado ${expected} dezenas para ${rules.slug} (${kind}), recebido ${numbers.length}`,
      path,
    });
  }
  numbers.forEach((n, i) => {
    if (typeof n !== "number" || !Number.isInteger(n)) {
      issues.push({
        code: "NOT_INTEGER",
        message: `dezena na posição ${i} não é inteiro: ${JSON.stringify(n)}`,
        path: `${path}[${i}]`,
      });
    } else if (n < rules.minNumber || n > rules.maxNumber) {
      issues.push({
        code: "OUT_OF_RANGE",
        message: `dezena ${n} fora do intervalo ${rules.minNumber}–${rules.maxNumber}`,
        path: `${path}[${i}]`,
      });
    }
  });
  const seen = new Set<unknown>();
  for (const n of numbers) {
    if (seen.has(n))
      issues.push({ code: "DUPLICATE", message: `dezena repetida: ${String(n)}`, path });
    seen.add(n);
  }
  for (let i = 1; i < numbers.length; i++) {
    if (
      typeof numbers[i] === "number" &&
      typeof numbers[i - 1] === "number" &&
      numbers[i] <= numbers[i - 1]
    ) {
      issues.push({ code: "NOT_SORTED", message: "dezenas devem estar em ordem crescente", path });
      break;
    }
  }
  return issues.length ? fail(issues) : ok();
}

export function isValidContest(contest: unknown): contest is number {
  return typeof contest === "number" && Number.isSafeInteger(contest) && contest > 0;
}

export interface NormalizedDrawLike {
  game: string;
  contest: number;
  draw_day: string;
  numbers: number[];
  draw_order: number[] | null;
  accumulated: boolean;
  estimated_prize: number | null;
  next_draw_day: string | null;
  next_contest: number | null;
}

/** Validação completa de um resultado já normalizado (estrutura + dezenas + concurso + datas). */
export function validateNormalizedDraw(
  draw: NormalizedDrawLike,
  rules: GameRules,
  options: { today?: string } = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (draw.game !== rules.slug) {
    issues.push({
      code: "GAME_MISMATCH",
      message: `resultado de ${draw.game} não pertence a ${rules.slug}`,
      path: "game",
    });
  }
  if (!isValidContest(draw.contest)) {
    issues.push({
      code: "INVALID_CONTEST",
      message: `número de concurso inválido: ${String(draw.contest)}`,
      path: "contest",
    });
  }
  const numbersCheck = validateNumberSet(draw.numbers, rules, "draw");
  issues.push(...numbersCheck.issues);
  if (draw.draw_order !== null) {
    const a = [...draw.draw_order].sort((x, y) => x - y);
    const same = a.length === draw.numbers.length && a.every((v, i) => v === draw.numbers[i]);
    if (!same) {
      issues.push({
        code: "DRAW_ORDER_MISMATCH",
        message: "dezenas na ordem do sorteio não batem com a lista de dezenas",
        path: "draw_order",
      });
    }
  }
  if (!isIsoDay(draw.draw_day)) {
    issues.push({
      code: "INVALID_DATE",
      message: `data do sorteio inválida: ${String(draw.draw_day)}`,
      path: "draw_day",
    });
  } else if (options.today && draw.draw_day > options.today) {
    issues.push({
      code: "DATE_IN_FUTURE",
      message: `data do sorteio no futuro: ${draw.draw_day}`,
      path: "draw_day",
    });
  }
  if (draw.next_draw_day !== null) {
    if (!isIsoDay(draw.next_draw_day)) {
      issues.push({
        code: "INVALID_NEXT_DATE",
        message: "data do próximo concurso inválida",
        path: "next_draw_day",
      });
    } else if (isIsoDay(draw.draw_day) && draw.next_draw_day <= draw.draw_day) {
      issues.push({
        code: "NEXT_DATE_NOT_AFTER",
        message: "próximo sorteio não é posterior ao sorteio",
        path: "next_draw_day",
      });
    }
  }
  if (draw.next_contest !== null && draw.next_contest !== draw.contest + 1) {
    issues.push({
      code: "NEXT_CONTEST_MISMATCH",
      message: `próximo concurso (${draw.next_contest}) deveria ser ${draw.contest + 1}`,
      path: "next_contest",
    });
  }
  if (typeof draw.accumulated !== "boolean") {
    issues.push({
      code: "INVALID_ACCUMULATED",
      message: "campo acumulado deve ser booleano",
      path: "accumulated",
    });
  }
  if (
    draw.estimated_prize !== null &&
    (!Number.isFinite(draw.estimated_prize) || draw.estimated_prize < 0)
  ) {
    issues.push({
      code: "INVALID_PRIZE",
      message: "estimativa de prêmio inválida",
      path: "estimated_prize",
    });
  }
  return issues.length ? fail(issues) : ok();
}

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
