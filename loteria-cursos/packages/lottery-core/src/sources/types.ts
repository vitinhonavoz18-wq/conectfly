import type { GameDefinition } from "../games.ts";
import type { NormalizedDraw } from "../normalizer.ts";
import type { ValidationIssue } from "../validator.ts";

/** Configuração da modalidade que a fonte precisa conhecer. */
export type SourceGameConfig = Pick<
  GameDefinition,
  | "slug"
  | "name"
  | "numbersDrawn"
  | "numbersPerBet"
  | "minNumber"
  | "maxNumber"
  | "sourceCode"
  | "sourceGameType"
  | "timezone"
>;

export type SourceErrorCode =
  /** Fonte fora do ar, timeout, 5xx, 429, resposta que não é JSON (transitório). */
  | "SOURCE_UNAVAILABLE"
  /** Concurso existe mas a fonte ainda não publicou as dezenas (transitório). */
  | "RESULT_NOT_READY"
  /** JSON com estrutura errada ou dados inconsistentes (NÃO publicar). */
  | "INVALID_PAYLOAD"
  /** Concurso inexistente na fonte. */
  | "NOT_FOUND";

export type SourceResult =
  | { ok: true; draw: NormalizedDraw }
  | {
      ok: false;
      errorCode: SourceErrorCode;
      retryable: boolean;
      message: string;
      issues?: ValidationIssue[];
      httpStatus?: number;
      rawPayload?: unknown;
    };

/**
 * Contrato de qualquer fonte de resultados. Para trocar a CAIXA por outra
 * fonte basta implementar esta interface e registrar em `createSourceAdapter`;
 * workflows, banco e renderer não mudam.
 */
export interface LotterySourceAdapter {
  readonly name: string;
  fetchLatest(game: SourceGameConfig): Promise<SourceResult>;
  fetchContest(game: SourceGameConfig, contest: number): Promise<SourceResult>;
}
