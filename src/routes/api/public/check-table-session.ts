import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED_ORIGINS = [
  "https://conectfly.com.br",
  "https://www.conectfly.com.br",
  "https://conectfly.lovable.app",
];

function getCorsHeaders(origin: string | null) {
  let allowOrigin = ALLOWED_ORIGINS[0];
  const isLovablePreview = origin && (
    origin.endsWith(".lovable.app") ||
    origin.includes("lovable.dev") ||
    ALLOWED_ORIGINS.includes(origin)
  );
  if (origin && isLovablePreview) {
    allowOrigin = origin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function joinUrl(base: string, path: string) {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

const CLOSED_RE = /(closed|fechad|finaliz|encerr|ended|expired|not[_ -]?found|inexist)/i;

/**
 * Non-mutating session status check. Queries FlyControl to determine whether a
 * table session is still open. Falls back to "open" when no signal is found so
 * that transient errors do not destroy a valid session.
 */
export const Route = createFileRoute("/api/public/check-table-session")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { headers: getCorsHeaders(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };

        try {
          const body = (await request.json()) as {
            restaurant_id?: string;
            table_token?: string;
            table_session_id?: string;
            table_number?: string;
          };

          if (!body?.restaurant_id || (!body.table_token && !body.table_session_id)) {
            return new Response(JSON.stringify({ success: false, error: "Dados incompletos" }), { status: 400, headers });
          }

          const { data: r, error } = await supabaseAdmin
            .from("restaurants")
            .select("id, slug, flycontrol_api_key, flycontrol_base_url")
            .eq("id", body.restaurant_id)
            .maybeSingle();

          if (error || !r) {
            return new Response(JSON.stringify({ success: false, error: "Restaurante não encontrado" }), { status: 404, headers });
          }

          let base = (r.flycontrol_base_url ?? "").trim();
          if (!base) {
            return new Response(JSON.stringify({ success: false, closed: false }), { status: 200, headers });
          }
          if (!base.startsWith("http")) base = "https://" + base;

          const key = (r.flycontrol_api_key ?? "").trim();
          const candidatePaths = [
            "api/public/check-table-session",
            "api/public/table-session-status",
            "api/public/get-table-session",
          ];

          const reqBody = JSON.stringify({
            restaurant_slug: r.slug,
            table_token: body.table_token ?? null,
            table_number: body.table_number ?? null,
            table_session_id: body.table_session_id ?? null,
            api_key: key,
          });

          let resolved: any = null;
          let lastStatus = 0;
          for (const path of candidatePaths) {
            try {
              const res = await fetch(joinUrl(base, path), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": key,
                  "Authorization": `Bearer ${key}`,
                },
                body: reqBody,
              });
              lastStatus = res.status;
              if (res.status === 404) continue;
              const txt = await res.text();
              try { resolved = JSON.parse(txt); } catch { resolved = { text: txt }; }
              break;
            } catch {
              continue;
            }
          }

          if (!resolved) {
            // No FlyControl endpoint available — assume still open to avoid
            // wiping a legit session on a transient/missing endpoint.
            return new Response(JSON.stringify({ success: true, closed: false, unavailable: true }), { status: 200, headers });
          }

          const rawStatus = (
            resolved?.status ?? resolved?.session_status ?? resolved?.response?.status ?? resolved?.response?.session_status ?? ""
          ).toString();
          const closedFlag = resolved?.closed === true || resolved?.response?.closed === true;
          const notFound = resolved?.error && /not[_ -]?found|inexist|invalid/i.test(String(resolved.error));
          const isClosed = closedFlag || CLOSED_RE.test(rawStatus) || !!notFound;

          return new Response(
            JSON.stringify({ success: true, closed: isClosed, status: rawStatus || null, http_status: lastStatus }),
            { status: 200, headers },
          );
        } catch (e: any) {
          console.error("[CHECK-TABLE-SESSION] Error:", e);
          return new Response(JSON.stringify({ success: false, closed: false, error: "Erro interno" }), { status: 500, headers });
        }
      },
    },
  },
});