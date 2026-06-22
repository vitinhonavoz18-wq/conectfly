import { createFileRoute } from "@tanstack/react-router";

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

const CLOSED_STATUSES = new Set([
  "closed",
  "fechada",
  "fechado",
  "finalized",
  "finalizada",
  "finalizado",
  "encerrada",
  "encerrado",
  "acknowledged",
  "approved",
  "completed",
  "done",
  "confirmed",
  "confirmada",
  "confirmado",
]);
const REJECTED_STATUSES = new Set([
  "rejected",
  "rejeitada",
  "rejeitado",
  "cancelled",
  "canceled",
  "cancelada",
  "cancelado",
  "denied",
]);

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

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Resolve the local restaurant_tables row by public_token (preferred)
          // because table sessions in FlyControl are mirrored locally via the
          // close-request flow.
          let tableId: string | null = null;
          if (body.table_token) {
            const { data: t } = await supabaseAdmin
              .from("restaurant_tables")
              .select("id, is_active")
              .eq("restaurant_id", body.restaurant_id)
              .eq("public_token", body.table_token)
              .maybeSingle();
            if (t) {
              tableId = t.id;
              if (t.is_active === false) {
                return new Response(
                  JSON.stringify({ success: true, closed: true, reason: "table_inactive" }),
                  { status: 200, headers },
                );
              }
            }
          }

          // 1) If we have a local session_id, trust table_sessions.status.
          if (body.table_session_id) {
            const { data: s } = await supabaseAdmin
              .from("table_sessions")
              .select("id, status, closed_at")
              .eq("id", body.table_session_id)
              .maybeSingle();
            if (s) {
              const st = (s.status ?? "").toString().toLowerCase();
              const isClosed = !!s.closed_at || (st !== "open" && st !== "");
              if (isClosed) {
                return new Response(
                  JSON.stringify({ success: true, closed: true, status: st, source: "table_sessions" }),
                  { status: 200, headers },
                );
              }
            }
          }

          // 2) Inspect the most recent close-request for this table. When the
          //    operator acts on it in FlyControl, status moves away from
          //    'pending'. Treat acknowledged/closed-like statuses as closed,
          //    and rejected/cancelled as still open.
          if (tableId) {
            const { data: req } = await supabaseAdmin
              .from("table_close_requests")
              .select("status, acknowledged_at, requested_at")
              .eq("restaurant_id", body.restaurant_id)
              .eq("table_id", tableId)
              .order("requested_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (req) {
              const st = (req.status ?? "").toString().toLowerCase();
              if (REJECTED_STATUSES.has(st)) {
                return new Response(
                  JSON.stringify({ success: true, closed: false, status: st, source: "close_requests" }),
                  { status: 200, headers },
                );
              }
              const isClosed = CLOSED_STATUSES.has(st) || (!!req.acknowledged_at && st !== "pending");
              if (isClosed) {
                return new Response(
                  JSON.stringify({ success: true, closed: true, status: st, source: "close_requests" }),
                  { status: 200, headers },
                );
              }
            }
          }

          return new Response(
            JSON.stringify({ success: true, closed: false }),
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