/** Utilitários de data/fuso sem dependências externas (Intl nativo). */

/** "30/09/2026" → "2026-09-30" (null se não for uma data real). */
export function parseBrDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m as unknown as [string, string, string, string];
  const iso = `${yyyy}-${mm}-${dd}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

/** Diferença (em minutos) entre o horário local do fuso e UTC num instante. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** Converte data+hora locais de um fuso em instante UTC (ISO 8601). */
export function zonedToUtcIso(day: string, time: string, timeZone: string): string {
  const [y, mo, d] = day.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  let offset = offsetMinutes(guess, timeZone);
  let result = new Date(guess.getTime() - offset * 60000);
  const offset2 = offsetMinutes(result, timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    result = new Date(guess.getTime() - offset * 60000);
  }
  return result.toISOString();
}

/** Data local (YYYY-MM-DD) de um instante num fuso. */
export function localDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return parts;
}

/** "2026-09-30" → "30/09/2026" */
export function formatBrDay(isoDay: string): string {
  const [y, m, d] = isoDay.split("-");
  return `${d}/${m}/${y}`;
}
