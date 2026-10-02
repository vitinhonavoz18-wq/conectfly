import { computeBackoffMs, parseRetryAfter } from "@lc/shared";

/**
 * Classificação das respostas da Graph API (Instagram).
 *
 * success → seguir | retry → esperar e repetir | fail → parar (FAILED)
 * Erros permanentes (token inválido, permissão ausente, parâmetro inválido)
 * NUNCA são repetidos. HTTP 200 sem os campos esperados também é falha.
 */

export type MetaOperation =
  | "create_container"
  | "container_status"
  | "media_publish"
  | "insights"
  | "me"
  | "publishing_limit";

export const CONTAINER_STATUSES = [
  "IN_PROGRESS",
  "FINISHED",
  "ERROR",
  "EXPIRED",
  "PUBLISHED",
] as const;

export interface MetaHttpResult {
  status_code?: number | null;
  body?: unknown;
  headers?: Record<string, unknown> | null;
  error?: string | null;
}

export interface MetaClassifyOptions {
  operation: MetaOperation;
  attempt: number;
  maxAttempts: number;
  random?: () => number;
}

export interface MetaClassification {
  outcome: "success" | "retry" | "fail" | "wait" | "ready" | "already_published";
  operation: MetaOperation;
  attempt: number;
  delay_seconds: number;
  permanent: boolean;
  error_code: string | null;
  error_message: string | null;
  graph_error: {
    code?: number;
    error_subcode?: number;
    type?: string;
    is_transient?: boolean;
    fbtrace_id?: string;
  } | null;
  data: Record<string, unknown>;
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001, 80002, 80006]);
const TRANSIENT_CODES = new Set([1, 2, 9007]);
const PERMISSION_CODES = new Set([3, 10]);
/** Subcódigos do Instagram tratados como "mídia ainda não pronta"/indisponível temporariamente. */
const TRANSIENT_SUBCODES = new Set([2207027, 2207052, 2207053, 2207001]);
const QUOTA_SUBCODES = new Set([2207042]);

export const META_RETRY_POLICY = { baseMs: 5_000, factor: 3, maxMs: 120_000, jitterRatio: 0.2 };
export const META_RATE_LIMIT_POLICY = {
  baseMs: 30_000,
  factor: 2,
  maxMs: 120_000,
  jitterRatio: 0.2,
};
export const CONTAINER_POLL_POLICY = {
  baseMs: 5_000,
  factor: 1.6,
  maxMs: 60_000,
  jitterRatio: 0.1,
};

function graphError(body: unknown) {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error: unknown }).error;
    if (e && typeof e === "object")
      return e as {
        message?: string;
        code?: number;
        error_subcode?: number;
        type?: string;
        is_transient?: boolean;
        fbtrace_id?: string;
      };
  }
  return null;
}

export function classifyMetaResponse(
  http: MetaHttpResult,
  options: MetaClassifyOptions,
): MetaClassification {
  const { operation, attempt, maxAttempts } = options;
  const status = typeof http.status_code === "number" ? http.status_code : 0;
  const err = graphError(http.body);
  const base: MetaClassification = {
    outcome: "fail",
    operation,
    attempt,
    delay_seconds: 0,
    permanent: false,
    error_code: null,
    error_message: null,
    graph_error: err
      ? {
          code: err.code,
          error_subcode: err.error_subcode,
          type: err.type,
          is_transient: err.is_transient,
          fbtrace_id: err.fbtrace_id,
        }
      : null,
    data: {},
  };

  const retryOrFail = (
    code: string,
    message: string,
    policy = META_RETRY_POLICY,
  ): MetaClassification => {
    if (attempt >= maxAttempts) {
      return {
        ...base,
        outcome: "fail",
        error_code: `${code}_MAX_ATTEMPTS`,
        error_message: `${message} (tentativas esgotadas: ${attempt})`,
      };
    }
    const hinted = parseRetryAfter(
      String((http.headers?.["retry-after"] as string | undefined) ?? ""),
    );
    const delayMs = Math.min(
      hinted ?? computeBackoffMs(attempt, policy, options.random),
      policy.maxMs,
    );
    return {
      ...base,
      outcome: "retry",
      error_code: code,
      error_message: message,
      delay_seconds: Math.max(1, Math.round(delayMs / 1000)),
    };
  };
  const permanent = (code: string, message: string): MetaClassification => ({
    ...base,
    outcome: "fail",
    permanent: true,
    error_code: code,
    error_message: message,
  });

  if (status === 0 || http.error)
    return retryOrFail("NETWORK_ERROR", `falha de rede/timeout: ${http.error ?? "sem resposta"}`);

  if (status >= 200 && status < 300 && !err) return classifySuccess(http.body, base, options);

  const msg = err?.message ?? `HTTP ${status}`;
  const code = err?.code;
  const sub = err?.error_subcode;
  if (code === 190 || code === 102 || status === 401)
    return permanent("TOKEN_INVALID", `token de acesso inválido ou expirado: ${msg}`);
  if (
    (code !== undefined && PERMISSION_CODES.has(code)) ||
    (code !== undefined && code >= 200 && code <= 299)
  ) {
    return permanent("PERMISSION_DENIED", `permissão ausente: ${msg}`);
  }
  if (sub !== undefined && QUOTA_SUBCODES.has(sub))
    return permanent("PUBLISHING_LIMIT_REACHED", `limite de publicações atingido: ${msg}`);
  if (status === 429 || (code !== undefined && RATE_LIMIT_CODES.has(code))) {
    return retryOrFail("RATE_LIMITED", `limite de requisições: ${msg}`, META_RATE_LIMIT_POLICY);
  }
  if (sub !== undefined && TRANSIENT_SUBCODES.has(sub))
    return retryOrFail("MEDIA_NOT_READY", `mídia ainda não disponível: ${msg}`);
  if (
    status >= 500 ||
    (code !== undefined && TRANSIENT_CODES.has(code)) ||
    err?.is_transient === true
  ) {
    return retryOrFail("TRANSIENT_ERROR", `erro temporário da Meta: ${msg}`);
  }
  if (code === 100 || status === 400)
    return permanent("INVALID_REQUEST", `requisição inválida: ${msg}`);
  return permanent("UNEXPECTED_ERROR", `erro não recuperável: ${msg}`);
}

function classifySuccess(
  body: unknown,
  base: MetaClassification,
  options: MetaClassifyOptions,
): MetaClassification {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const invalid = (what: string): MetaClassification => ({
    ...base,
    outcome: "fail",
    permanent: true,
    error_code: "INVALID_RESPONSE",
    error_message: `HTTP 200 sem ${what} — formato inesperado, publicação interrompida`,
  });
  switch (options.operation) {
    case "create_container":
      return typeof b.id === "string" && b.id
        ? { ...base, outcome: "success", data: { container_id: b.id } }
        : invalid("id do container");
    case "media_publish":
      return typeof b.id === "string" && b.id
        ? { ...base, outcome: "success", data: { media_id: b.id } }
        : invalid("id da mídia");
    case "container_status": {
      const sc = b.status_code;
      if (typeof sc !== "string" || !(CONTAINER_STATUSES as readonly string[]).includes(sc))
        return invalid("status_code conhecido");
      const data = { status_code: sc, status: typeof b.status === "string" ? b.status : null };
      if (sc === "FINISHED") return { ...base, outcome: "ready", data };
      if (sc === "PUBLISHED") return { ...base, outcome: "already_published", data };
      if (sc === "ERROR")
        return {
          ...base,
          outcome: "fail",
          permanent: true,
          error_code: "CONTAINER_ERROR",
          error_message: `container com erro: ${String(b.status ?? "")}`,
          data,
        };
      if (sc === "EXPIRED")
        return {
          ...base,
          outcome: "fail",
          permanent: true,
          error_code: "CONTAINER_EXPIRED",
          error_message: "container expirou (não publicado em 24h)",
          data,
        };
      // IN_PROGRESS
      if (options.attempt >= options.maxAttempts) {
        return {
          ...base,
          outcome: "fail",
          error_code: "CONTAINER_TIMEOUT",
          error_message: `container não ficou FINISHED após ${options.attempt} verificações`,
          data,
        };
      }
      const delayMs = computeBackoffMs(options.attempt, CONTAINER_POLL_POLICY, options.random);
      return {
        ...base,
        outcome: "wait",
        delay_seconds: Math.max(1, Math.round(delayMs / 1000)),
        data,
      };
    }
    case "insights":
      return Array.isArray(b.data)
        ? { ...base, outcome: "success", data: { metrics: b.data } }
        : invalid("lista de métricas");
    case "me":
      return typeof b.id === "string" ||
        typeof b.user_id === "string" ||
        typeof b.user_id === "number"
        ? {
            ...base,
            outcome: "success",
            data: { id: b.id ?? b.user_id, username: b.username ?? null },
          }
        : invalid("identificação da conta");
    case "publishing_limit":
      return Array.isArray(b.data)
        ? { ...base, outcome: "success", data: { limit: b.data[0] ?? null } }
        : invalid("dados de limite");
  }
}

/** Monta o corpo da criação do container conforme o tipo de mídia. */
export function buildContainerRequest(input: {
  media_type: "IMAGE" | "STORIES" | "REELS" | "CAROUSEL_ITEM";
  media_url: string;
  caption?: string;
}): Record<string, unknown> {
  if (!/^https?:\/\//.test(input.media_url))
    throw new Error("media_url deve ser uma URL http(s) pública");
  switch (input.media_type) {
    case "IMAGE":
      return { image_url: input.media_url, caption: input.caption ?? "" };
    case "STORIES":
      return { media_type: "STORIES", image_url: input.media_url };
    case "REELS":
      return { media_type: "REELS", video_url: input.media_url, caption: input.caption ?? "" };
    case "CAROUSEL_ITEM":
      return { image_url: input.media_url, is_carousel_item: true };
  }
}

/** Corpo do container "pai" de um carrossel (até 10 itens). */
export function buildCarouselRequest(
  childrenIds: string[],
  caption: string,
): Record<string, unknown> {
  if (childrenIds.length < 2 || childrenIds.length > 10)
    throw new Error("carrossel precisa de 2 a 10 itens");
  return { media_type: "CAROUSEL", children: childrenIds.join(","), caption };
}
