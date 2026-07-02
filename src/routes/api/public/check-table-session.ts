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
  "finished",
  "fechada",
  "fechado",
  "finalizada",
  "finalizado",
  "encerrada",
  "encerrado",
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
            dining_session_id?: string;
            customer_token?: string;
          };

          if (!body?.restaurant_id || (!body.dining_session_id && !body.table_session_id)) {
            return new Response(JSON.stringify({ success: false, error: "Dados incompletos" }), { status: 400, headers });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // AUTHORITATIVE SOURCE OF TRUTH: dining_sessions.status.
          // Only `status = 'active'` allows ordering. Any other state (or a
          // missing row) means the customer must scan the QR again.
          if (body.dining_session_id) {
            const { data: ds, error: dsErr } = await supabaseAdmin
              .from("dining_sessions")
              .select("id, status, closed_at, customer_token")
              .eq("id", body.dining_session_id)
              .eq("restaurant_id", body.restaurant_id)
              .maybeSingle();

            if (dsErr || !ds) {
              return new Response(
                JSON.stringify({ success: true, closed: true, reason: "dining_session_not_found", source: "dining_sessions" }),
                { status: 200, headers },
              );
            }
            // Optional bind check: customer_token must match when supplied.
            if (body.customer_token && ds.customer_token && body.customer_token !== ds.customer_token) {
              return new Response(
                JSON.stringify({ success: true, closed: true, reason: "customer_token_mismatch", source: "dining_sessions" }),
                { status: 200, headers },
              );
            }
            const isActive = ds.status === "active" && !ds.closed_at;
            return new Response(
              JSON.stringify({
                success: true,
                closed: !isActive,
                status: ds.status,
                source: "dining_sessions",
              }),
              { status: 200, headers },
            );
          }

          // Legacy path: fall back to table_sessions when no dining_session_id
          // was supplied (older clients / long-lived tabs pre-refactor).
          const { data: session, error: sessionError } = await supabaseAdmin
            .from("table_sessions")
            .select("id, table_id, status, closed_at")
            .eq("id", body.table_session_id!)
            .eq("restaurant_id", body.restaurant_id)
            .maybeSingle();

          if (sessionError || !session) {
            return new Response(
              JSON.stringify({ success: true, closed: true, reason: "session_not_found", source: "table_sessions" }),
              { status: 200, headers },
            );
          }

          const sessionStatus = (session.status ?? "").toString().trim().toLowerCase();
          const isClosed = !!session.closed_at || CLOSED_STATUSES.has(sessionStatus);

          return new Response(
            JSON.stringify({
              success: true,
              closed: isClosed,
              status: sessionStatus,
              source: "table_sessions",
            }),
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