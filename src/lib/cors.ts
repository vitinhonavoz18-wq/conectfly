// Shared CORS allowlist for FL ↔ SF cross-origin requests.
// Do NOT use a wildcard ("*") here — only validated origins receive
// Access-Control-Allow-Origin. Same-origin requests (no Origin header)
// pass through untouched and keep existing SF behavior intact.

const STATIC_ALLOWED_ORIGINS = new Set<string>([
  // FlyControl production
  "https://flycontrol.conectfly.com.br",
  "https://conectfly.com.br",
  "https://www.conectfly.com.br",
  // FlyControl dashboards / staging
  "https://flycontrol-dash.lovable.app",
  // Local development
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
]);

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:" && protocol !== "http:") return false;
    // Allow Lovable preview/dev subdomains (FL frontends are hosted here).
    if (hostname.endsWith(".lovable.app")) return true;
    if (hostname.endsWith(".conectfly.com.br")) return true;
    return false;
  } catch {
    return false;
  }
}

export function buildCorsHeaders(
  request: Request,
  options: { methods?: string; headers?: string } = {},
): Record<string, string> {
  const origin = request.headers.get("origin");
  const methods = options.methods ?? "GET, POST, PUT, DELETE, OPTIONS";
  const headers =
    options.headers ??
    "Content-Type, Authorization, X-Requested-With, Accept, Origin, x-api-key, apikey";

  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": headers,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (isAllowedOrigin(origin)) {
    base["Access-Control-Allow-Origin"] = origin;
    base["Access-Control-Allow-Credentials"] = "true";
    if (process.env.NODE_ENV !== "production") {
      console.log(`[CORS] Allowed origin: ${origin}`);
    }
  } else if (origin) {
    console.log(`[CORS] Rejected origin: ${origin}`);
  }

  return base;
}

export function preflightResponse(request: Request, options?: { methods?: string; headers?: string }) {
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, options) });
}

export function jsonWithCors(
  request: Request,
  body: unknown,
  init: ResponseInit = {},
  options?: { methods?: string; headers?: string },
) {
  const headers = {
    "Content-Type": "application/json",
    ...buildCorsHeaders(request, options),
    ...(init.headers as Record<string, string> | undefined),
  };
  return new Response(JSON.stringify(body), { ...init, headers });
}