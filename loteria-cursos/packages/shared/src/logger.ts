import { randomUUID } from "node:crypto";
import { redact } from "./redact.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export interface LoggerOptions {
  service: string;
  level?: LogLevel;
  base?: Record<string, unknown>;
  sink?: (line: string) => void;
}

/**
 * Log estruturado em JSON (uma linha por evento), com segredos mascarados.
 * Ex.: {"ts":"…","level":"info","service":"engine","event":"instagram_publish",
 *       "post_id":"…","game":"megasena","contest":3065,"status":"success","duration_ms":2412}
 */
export function createLogger(options: LoggerOptions): Logger {
  const threshold = ORDER[options.level ?? parseLevel(process.env.LOG_LEVEL)];
  const sink = options.sink ?? ((line: string) => process.stdout.write(`${line}\n`));
  const base = options.base ?? {};

  const emit = (level: LogLevel, event: string, fields: Record<string, unknown> = {}) => {
    if (ORDER[level] < threshold) return;
    const record = redact({
      ts: new Date().toISOString(),
      level,
      service: options.service,
      event,
      ...base,
      ...fields,
    });
    sink(JSON.stringify(record));
  };

  return {
    debug: (e, f) => emit("debug", e, f),
    info: (e, f) => emit("info", e, f),
    warn: (e, f) => emit("warn", e, f),
    error: (e, f) => emit("error", e, f),
    child: (fields) => createLogger({ ...options, base: { ...base, ...fields } }),
  };
}

export function parseLevel(value: string | undefined): LogLevel {
  const v = (value ?? "info").toLowerCase();
  return v === "debug" || v === "info" || v === "warn" || v === "error" ? v : "info";
}

/** Correlation ID: aceita o recebido (se for seguro) ou gera um novo. */
export function correlationId(incoming?: unknown): string {
  if (typeof incoming === "string" && /^[A-Za-z0-9._:-]{6,128}$/.test(incoming)) return incoming;
  return randomUUID();
}
