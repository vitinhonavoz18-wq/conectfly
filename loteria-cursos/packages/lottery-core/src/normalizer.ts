import { canonicalJson, sha256Hex } from "@lc/shared";
import type { NormalizedDrawLike } from "./validator.ts";

export interface NormalizedDraw extends NormalizedDrawLike {
  /** Instante UTC equivalente à meia-noite local da data oficial (a fonte só informa a data). */
  draw_date: string;
  next_draw: string | null;
  source: string;
  source_url: string;
  fetched_at: string;
  raw_payload: unknown;
  source_hash: string;
}

/**
 * Hash do resultado oficial normalizado.
 * Cobre só o que é IMUTÁVEL num resultado: modalidade, concurso, data, dezenas e
 * se acumulou. Estimativas de prêmio podem ser revisadas pela CAIXA depois do
 * sorteio e por isso não entram — senão uma revisão de estimativa viraria
 * "conflito de dados" sem que o resultado tenha mudado.
 */
export function computeSourceHash(
  draw: Pick<NormalizedDrawLike, "game" | "contest" | "draw_day" | "numbers" | "accumulated">,
): string {
  return sha256Hex(
    canonicalJson({
      game: draw.game,
      contest: draw.contest,
      draw_day: draw.draw_day,
      numbers: [...draw.numbers].sort((a, b) => a - b),
      accumulated: draw.accumulated,
    }),
  );
}

/** "04" → 4; recusa qualquer coisa que não seja só dígitos. */
export function parseDezena(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value.trim())) return null;
  return Number(value.trim());
}

/** Converte valores monetários que podem vir como número ou texto "1.234,56". */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[R$\s]/g, "");
    const normalized = cleaned.includes(",")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
