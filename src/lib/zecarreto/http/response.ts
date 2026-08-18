/**
 * Respostas HTTP padronizadas do ZÉ CARRETO.
 * Todo endpoint devolve JSON no mesmo formato — o app nunca precisa
 * adivinhar onde está o erro.
 */

import { ZcError, isZcError } from "../errors";

const DEFAULT_ORIGINS = [
  "https://zecarreto.com.br",
  "https://www.zecarreto.com.br",
  "https://conectfly.com.br",
  "https://www.conectfly.com.br",
];

function allowedOrigins(): string[] {
  const fromEnv = process.env.ZC_ALLOWED_ORIGINS;
  if (!fromEnv) return DEFAULT_ORIGINS;
  return fromEnv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function zcCorsHeaders(origin: string | null): Record<string, string> {
  const list = allowedOrigins();
  const isPreview =
    !!origin && (origin.endsWith(".lovable.app") || origin.endsWith(".workers.dev"));
  const allowOrigin = origin && (list.includes(origin) || isPreview) ? origin : list[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "content-type, authorization, apikey, x-idempotency-key, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function zcJson(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...zcCorsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function zcOk<T>(data: T, origin: string | null = null, status = 200): Response {
  return zcJson({ success: true, data }, status, origin);
}

export function zcPreflight(origin: string | null): Response {
  return new Response(null, { status: 204, headers: zcCorsHeaders(origin) });
}

/**
 * Transforma qualquer erro em resposta HTTP. Erro conhecido vira mensagem
 * clara; erro inesperado vira 500 e vai para o log — nunca vaza detalhe
 * interno para a tela do cliente.
 */
export function zcFail(error: unknown, origin: string | null = null): Response {
  if (isZcError(error)) {
    return zcJson({ success: false, ...error.toJSON() }, error.status, origin);
  }
  console.error("[ZC] erro inesperado:", error);
  const fallback = new ZcError(
    "ZC_INTERNAL",
    "Tivemos um problema aqui do nosso lado. Tente de novo.",
  );
  return zcJson({ success: false, ...fallback.toJSON() }, 500, origin);
}
