import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_ORIGINS = [
  "https://conectfly.com.br",
  "https://www.conectfly.com.br",
  "https://conectfly.lovable.app",
];

function getCorsHeaders(origin: string | null) {
  let allowOrigin = ALLOWED_ORIGINS[0];
  const isLovablePreview =
    origin &&
    (origin.endsWith(".lovable.app") ||
      origin.includes("lovable.dev") ||
      ALLOWED_ORIGINS.includes(origin));
  if (origin && isLovablePreview) allowOrigin = origin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Webhook called by FlyControl when an operator closes a table.
 * Mirrors the closure into the local public.table_sessions row so the
 * Digital Menu's `checkTableSession` poll sees `closed: true` immediately.
 *
 * Payload:
 * { restaurant_id, table_number?, session_id?, table_token?, closed_at? }
 */
export const Route = createFileRoute("/api/public/flycontrol-table-closed")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { headers: getCorsHeaders(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };
        try {
          const body = (await request.json().catch(() => ({}))) as {
            restaurant_id?: string;
            table_number?: string | number | null;
            session_id?: string | null;
            table_token?: string | null;
            closed_at?: string | null;
          };

          const restaurantId = body?.restaurant_id;
          if (!restaurantId) {
            return new Response(
              JSON.stringify({ success: false, error: "restaurant_id is required" }),
              { status: 400, headers },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const closedAt = body.closed_at ?? new Date().toISOString();

          // Resolve table_id from token or number for the close-request mirror.
          let tableId: string | null = null;
          if (body.table_token) {
            const { data: t } = await supabaseAdmin
              .from("restaurant_tables")
              .select("id")
              .eq("restaurant_id", restaurantId)
              .eq("public_token", String(body.table_token))
              .maybeSingle();
            if (t) tableId = t.id;
          }
          if (!tableId && body.table_number != null) {
            const { data: t } = await supabaseAdmin
              .from("restaurant_tables")
              .select("id")
              .eq("restaurant_id", restaurantId)
              .eq("table_number", String(body.table_number))
              .maybeSingle();
            if (t) tableId = t.id;
          }

          // 1) Update table_sessions -> status=closed, closed_at=now
          let sessionsUpdated = 0;
          if (body.session_id) {
            const { data, error } = await supabaseAdmin
              .from("table_sessions")
              .update({ status: "closed", closed_at: closedAt })
              .eq("id", body.session_id)
              .eq("restaurant_id", restaurantId)
              .select("id");
            if (error) console.error("[FC-TABLE-CLOSED] sessions update by id error:", error);
            sessionsUpdated += data?.length ?? 0;
          } else if (tableId) {
            const { data, error } = await supabaseAdmin
              .from("table_sessions")
              .update({ status: "closed", closed_at: closedAt })
              .eq("restaurant_id", restaurantId)
              .eq("table_id", tableId)
              .eq("status", "open")
              .select("id");
            if (error) console.error("[FC-TABLE-CLOSED] sessions update by table error:", error);
            sessionsUpdated += data?.length ?? 0;
          } else if (body.table_number != null) {
            const { data, error } = await supabaseAdmin
              .from("table_sessions")
              .update({ status: "closed", closed_at: closedAt })
              .eq("restaurant_id", restaurantId)
              .eq("table_number", String(body.table_number))
              .eq("status", "open")
              .select("id");
            if (error) console.error("[FC-TABLE-CLOSED] sessions update by number error:", error);
            sessionsUpdated += data?.length ?? 0;
          }

          // 2) Acknowledge any pending close requests for this table.
          if (tableId) {
            await supabaseAdmin
              .from("table_close_requests")
              .update({ status: "acknowledged", acknowledged_at: closedAt })
              .eq("restaurant_id", restaurantId)
              .eq("table_id", tableId)
              .eq("status", "pending");
          }

          console.log("[FC-TABLE-CLOSED]", {
            restaurantId,
            tableId,
            session_id: body.session_id ?? null,
            table_number: body.table_number ?? null,
            sessionsUpdated,
          });

          return new Response(
            JSON.stringify({ success: true, sessions_updated: sessionsUpdated }),
            { status: 200, headers },
          );
        } catch (e: any) {
          console.error("[FC-TABLE-CLOSED] Error:", e);
          return new Response(
            JSON.stringify({ success: false, error: "internal_error" }),
            { status: 500, headers },
          );
        }
      },
    },
  },
});