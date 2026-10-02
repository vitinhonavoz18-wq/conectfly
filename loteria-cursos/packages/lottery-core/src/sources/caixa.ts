import { z } from "zod";
import { fetchWithTimeout, isTransientStatus, sleep, computeBackoffMs } from "@lc/shared";
import { computeSourceHash, parseDezena, parseMoney, type NormalizedDraw } from "../normalizer.ts";
import { parseBrDate, zonedToUtcIso, localDay } from "../time.ts";
import { validateNormalizedDraw, type ValidationIssue } from "../validator.ts";
import type { LotterySourceAdapter, SourceGameConfig, SourceResult } from "./types.ts";

/**
 * Fonte: endpoint JSON usado pelo próprio portal de Loterias da CAIXA
 * (https://servicebus2.caixa.gov.br/portaldeloterias/api/{modalidade}[/{concurso}]).
 *
 * ATENÇÃO: este endpoint fica no domínio oficial da CAIXA, mas NÃO é uma API
 * pública documentada para desenvolvedores (não há contrato, versão ou SLA
 * publicados). Ele pode mudar sem aviso. Por isso: o formato é validado campo a
 * campo, qualquer divergência bloqueia a publicação, e a fonte é trocável.
 * Detalhes em docs/LOTTERY_SOURCE.md.
 */

export const CAIXA_DEFAULT_BASE_URL = "https://servicebus2.caixa.gov.br/portaldeloterias/api";

/** Campos mínimos esperados. Campos extras são aceitos e guardados em raw_payload. */
export const caixaPayloadSchema = z
  .object({
    numero: z.number().int().positive(),
    tipoJogo: z.string().min(1),
    dataApuracao: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    listaDezenas: z.array(z.string().regex(/^\d{1,3}$/)),
    dezenasSorteadasOrdemSorteio: z.array(z.string().regex(/^\d{1,3}$/)).nullish(),
    acumulado: z.boolean(),
    valorEstimadoProximoConcurso: z.union([z.number(), z.string()]).nullish(),
    dataProximoConcurso: z.string().nullish(),
    numeroConcursoProximo: z.number().int().nullish(),
    numeroConcursoAnterior: z.number().int().nullish(),
  })
  .loose();

export type CaixaPayload = z.infer<typeof caixaPayloadSchema>;

export interface CaixaAdapterOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  userAgent?: string;
  now?: () => Date;
  fetchImpl?: typeof fetchWithTimeout;
  sleepImpl?: (ms: number) => Promise<void>;
}

/** Converte o JSON da CAIXA no formato normalizado + validação completa. */
export function normalizeCaixaPayload(
  raw: unknown,
  game: SourceGameConfig,
  meta: { sourceUrl: string; fetchedAt: Date },
): SourceResult {
  const parsed = caixaPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const issues: ValidationIssue[] = parsed.error.issues.map((i) => ({
      code: "SCHEMA",
      message: i.message,
      path: i.path.join("."),
    }));
    return {
      ok: false,
      errorCode: "INVALID_PAYLOAD",
      retryable: false,
      message: "estrutura inesperada no JSON da fonte",
      issues,
      rawPayload: raw,
    };
  }
  const p = parsed.data;

  if (p.tipoJogo !== game.sourceGameType) {
    return {
      ok: false,
      errorCode: "INVALID_PAYLOAD",
      retryable: false,
      message: `tipoJogo "${p.tipoJogo}" não corresponde a ${game.sourceGameType}`,
      issues: [{ code: "GAME_TYPE_MISMATCH", message: "modalidade divergente", path: "tipoJogo" }],
      rawPayload: raw,
    };
  }

  if (p.listaDezenas.length === 0) {
    return {
      ok: false,
      errorCode: "RESULT_NOT_READY",
      retryable: true,
      message: "concurso ainda sem dezenas publicadas",
      rawPayload: raw,
    };
  }

  const numbers = p.listaDezenas.map(parseDezena);
  const order = p.dezenasSorteadasOrdemSorteio?.length
    ? p.dezenasSorteadasOrdemSorteio.map(parseDezena)
    : null;
  if (numbers.some((n) => n === null) || (order && order.some((n) => n === null))) {
    return {
      ok: false,
      errorCode: "INVALID_PAYLOAD",
      retryable: false,
      message: "dezena não numérica",
      rawPayload: raw,
    };
  }
  const drawDay = parseBrDate(p.dataApuracao);
  if (!drawDay) {
    return {
      ok: false,
      errorCode: "INVALID_PAYLOAD",
      retryable: false,
      message: `data inválida: ${p.dataApuracao}`,
      issues: [{ code: "INVALID_DATE", message: "dataApuracao inválida", path: "dataApuracao" }],
      rawPayload: raw,
    };
  }
  const nextDay = p.dataProximoConcurso ? parseBrDate(p.dataProximoConcurso) : null;
  if (p.dataProximoConcurso && !nextDay) {
    return {
      ok: false,
      errorCode: "INVALID_PAYLOAD",
      retryable: false,
      message: `data do próximo concurso inválida: ${p.dataProximoConcurso}`,
      rawPayload: raw,
    };
  }

  // Ordenação numérica é a ÚNICA transformação feita nas dezenas oficiais.
  const sorted = (numbers as number[]).slice().sort((a, b) => a - b);
  const draw: NormalizedDraw = {
    game: game.slug,
    contest: p.numero,
    draw_day: drawDay,
    draw_date: zonedToUtcIso(drawDay, "00:00", game.timezone),
    numbers: sorted,
    draw_order: order as number[] | null,
    accumulated: p.acumulado,
    estimated_prize: parseMoney(p.valorEstimadoProximoConcurso),
    next_draw_day: nextDay,
    next_draw: nextDay ? zonedToUtcIso(nextDay, "00:00", game.timezone) : null,
    next_contest: p.numeroConcursoProximo ?? null,
    source: "caixa",
    source_url: meta.sourceUrl,
    fetched_at: meta.fetchedAt.toISOString(),
    raw_payload: raw,
    source_hash: "",
  };

  const check = validateNormalizedDraw(draw, game, {
    today: localDay(meta.fetchedAt, game.timezone),
  });
  const issues = [...check.issues];
  if (issues.length) {
    return {
      ok: false,
      errorCode: "INVALID_PAYLOAD",
      retryable: false,
      message: "dados inconsistentes na fonte",
      issues,
      rawPayload: raw,
    };
  }
  draw.source_hash = computeSourceHash(draw);
  return { ok: true, draw };
}

export class CaixaSourceAdapter implements LotterySourceAdapter {
  readonly name = "caixa";
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly userAgent: string;
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetchWithTimeout;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  constructor(options: CaixaAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? CAIXA_DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    this.userAgent = options.userAgent ?? "LoteriaCursosAutomation/1.0";
    this.now = options.now ?? (() => new Date());
    this.fetchImpl = options.fetchImpl ?? fetchWithTimeout;
    this.sleepImpl = options.sleepImpl ?? sleep;
  }

  fetchLatest(game: SourceGameConfig): Promise<SourceResult> {
    return this.request(game, `${this.baseUrl}/${encodeURIComponent(game.sourceCode)}`);
  }

  async fetchContest(game: SourceGameConfig, contest: number): Promise<SourceResult> {
    const result = await this.request(
      game,
      `${this.baseUrl}/${encodeURIComponent(game.sourceCode)}/${contest}`,
    );
    if (result.ok && result.draw.contest !== contest) {
      return {
        ok: false,
        errorCode: "INVALID_PAYLOAD",
        retryable: false,
        message: `pedido o concurso ${contest}, fonte devolveu ${result.draw.contest}`,
        rawPayload: result.draw.raw_payload,
      };
    }
    return result;
  }

  private async request(game: SourceGameConfig, url: string): Promise<SourceResult> {
    let last: SourceResult | undefined;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      last = await this.once(game, url);
      if (
        last.ok ||
        !last.retryable ||
        last.errorCode === "RESULT_NOT_READY" ||
        attempt === this.maxAttempts
      )
        return last;
      await this.sleepImpl(
        computeBackoffMs(attempt, { baseMs: 2_000, factor: 3, maxMs: 20_000, jitterRatio: 0.2 }),
      );
    }
    return last as SourceResult;
  }

  private async once(game: SourceGameConfig, url: string): Promise<SourceResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        timeoutMs: this.timeoutMs,
        headers: { Accept: "application/json", "User-Agent": this.userAgent },
      });
    } catch (error) {
      return {
        ok: false,
        errorCode: "SOURCE_UNAVAILABLE",
        retryable: true,
        message: `falha de rede/timeout ao consultar a fonte: ${(error as Error).message}`,
      };
    }
    const text = await response.text();
    if (response.status === 404) {
      return {
        ok: false,
        errorCode: "NOT_FOUND",
        retryable: false,
        message: "concurso não encontrado na fonte",
        httpStatus: 404,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        errorCode: "SOURCE_UNAVAILABLE",
        retryable: isTransientStatus(response.status),
        message: `fonte respondeu HTTP ${response.status}`,
        httpStatus: response.status,
      };
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // HTTP 200 com HTML (página de manutenção/bloqueio) não é resultado.
      return {
        ok: false,
        errorCode: "SOURCE_UNAVAILABLE",
        retryable: true,
        message: "fonte respondeu 200 mas o corpo não é JSON",
        httpStatus: response.status,
      };
    }
    const result = normalizeCaixaPayload(json, game, { sourceUrl: url, fetchedAt: this.now() });
    if (!result.ok) return { ...result, httpStatus: response.status };
    return result;
  }
}
