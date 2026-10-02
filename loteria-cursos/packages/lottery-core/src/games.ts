/**
 * Regras das modalidades. Em produção a fonte da verdade é a tabela
 * `lottery_games` (o n8n lê de lá e envia ao engine). Estes valores são os
 * padrões usados nos seeds e nos testes — um teste garante que os dois batem.
 */

export interface GameRules {
  slug: string;
  name: string;
  /** Quantas dezenas a CAIXA sorteia. */
  numbersDrawn: number;
  /** Quantas dezenas tem a aposta que geramos como palpite. */
  numbersPerBet: number;
  minNumber: number;
  maxNumber: number;
}

export interface DrawScheduleEntry {
  /** Dias da semana (0 = domingo … 6 = sábado). */
  days: number[];
  /** Horário local "HH:MM" no fuso da modalidade. */
  time: string;
}

export interface GameDefinition extends GameRules {
  enabled: boolean;
  /** Identificador do jogo na fonte (caminho no endpoint da CAIXA). */
  sourceCode: string;
  /** Valor esperado no campo `tipoJogo` da CAIXA (checagem de consistência). */
  sourceGameType: string;
  timezone: string;
  drawSchedule: DrawScheduleEntry[];
  predictionSchedule: { hoursBeforeDraw: number; bets: number };
  resultWindowMinutes: number;
  brandColor: string;
  hashtags: string[];
}

/**
 * Cronograma: desde 19/07/2026 a CAIXA transferiu os sorteios de sábado para
 * domingo às 11h (Mega-Sena, Lotofácil e Quina, entre outras). Dias úteis às 21h.
 * Fonte: comunicados divulgados na imprensa (jul/2026). CONFIRA em
 * https://loterias.caixa.gov.br/Paginas/regras-sorteios.aspx — e ajuste na tabela.
 */
export const DEFAULT_GAMES: Record<string, GameDefinition> = {
  megasena: {
    slug: "megasena",
    name: "Mega-Sena",
    enabled: true,
    numbersDrawn: 6,
    numbersPerBet: 6,
    minNumber: 1,
    maxNumber: 60,
    sourceCode: "megasena",
    sourceGameType: "MEGA_SENA",
    timezone: "America/Bahia",
    drawSchedule: [
      { days: [2, 4], time: "21:00" },
      { days: [0], time: "11:00" },
    ],
    predictionSchedule: { hoursBeforeDraw: 5, bets: 1 },
    resultWindowMinutes: 20,
    brandColor: "#1B8F5A",
    hashtags: ["#megasena", "#loteria", "#loteriacursos"],
  },
  lotofacil: {
    slug: "lotofacil",
    name: "Lotofácil",
    enabled: true,
    numbersDrawn: 15,
    numbersPerBet: 15,
    minNumber: 1,
    maxNumber: 25,
    sourceCode: "lotofacil",
    sourceGameType: "LOTOFACIL",
    timezone: "America/Bahia",
    drawSchedule: [
      { days: [1, 2, 3, 4, 5], time: "21:00" },
      { days: [0], time: "11:00" },
    ],
    predictionSchedule: { hoursBeforeDraw: 5, bets: 1 },
    resultWindowMinutes: 20,
    brandColor: "#8E1A9C",
    hashtags: ["#lotofacil", "#loteria", "#loteriacursos"],
  },
  quina: {
    slug: "quina",
    name: "Quina",
    enabled: true,
    numbersDrawn: 5,
    numbersPerBet: 5,
    minNumber: 1,
    maxNumber: 80,
    sourceCode: "quina",
    sourceGameType: "QUINA",
    timezone: "America/Bahia",
    drawSchedule: [
      { days: [1, 2, 3, 4, 5], time: "21:00" },
      { days: [0], time: "11:00" },
    ],
    predictionSchedule: { hoursBeforeDraw: 5, bets: 1 },
    resultWindowMinutes: 20,
    brandColor: "#1F4FBF",
    hashtags: ["#quina", "#loteria", "#loteriacursos"],
  },
  lotomania: {
    slug: "lotomania",
    name: "Lotomania",
    enabled: true,
    numbersDrawn: 20,
    numbersPerBet: 50,
    minNumber: 0,
    maxNumber: 99,
    sourceCode: "lotomania",
    sourceGameType: "LOTOMANIA",
    timezone: "America/Bahia",
    drawSchedule: [{ days: [1, 3, 5], time: "21:00" }],
    predictionSchedule: { hoursBeforeDraw: 5, bets: 1 },
    resultWindowMinutes: 20,
    brandColor: "#F28C1B",
    hashtags: ["#lotomania", "#loteria", "#loteriacursos"],
  },
};

/** Converte a linha da tabela `lottery_games` (snake_case) para GameRules. */
export function rulesFromRow(row: Record<string, unknown>): GameRules {
  return {
    slug: String(row.slug),
    name: String(row.name),
    numbersDrawn: Number(row.numbers_drawn),
    numbersPerBet: Number(row.numbers_per_bet),
    minNumber: Number(row.min_number),
    maxNumber: Number(row.max_number),
  };
}

export function assertValidRules(rules: GameRules): void {
  const universe = rules.maxNumber - rules.minNumber + 1;
  const problems: string[] = [];
  if (!/^[a-z0-9_]+$/.test(rules.slug)) problems.push("slug inválido");
  for (const k of ["numbersDrawn", "numbersPerBet", "minNumber", "maxNumber"] as const) {
    if (!Number.isInteger(rules[k])) problems.push(`${k} deve ser inteiro`);
  }
  if (rules.minNumber < 0) problems.push("minNumber negativo");
  if (universe < 2) problems.push("intervalo de dezenas inválido");
  if (rules.numbersDrawn < 1 || rules.numbersDrawn > universe)
    problems.push("numbersDrawn fora do intervalo");
  if (rules.numbersPerBet < 1 || rules.numbersPerBet > universe)
    problems.push("numbersPerBet fora do intervalo");
  if (problems.length)
    throw new Error(`Regras da modalidade inválidas (${rules.slug}): ${problems.join("; ")}`);
}
