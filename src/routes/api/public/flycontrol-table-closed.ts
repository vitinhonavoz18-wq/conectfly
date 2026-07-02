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
 * { restaurant_id, session_id, closed_at? }
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
            dining_session_id?: string | null;
            customer_token?: string | null;
            table_token?: string | null;
            closed_at?: string | null;
          };

          const restaurantId = body?.restaurant_id;
          const sessionId = body?.session_id?.trim();
          const diningSessionId = body?.dining_session_id?.trim() || null;
          const customerToken = body?.customer_token?.trim() || null;
          if (!restaurantId) {
            return new Response(
              JSON.stringify({ success: false, error: "restaurant_id is required" }),
              { status: 400, headers },
            );
          }

          if (!sessionId && !diningSessionId) {
            return new Response(
              JSON.stringify({ success: false, error: "session_id or dining_session_id is required" }),
              { status: 400, headers },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const closedAt = body.closed_at ?? new Date().toISOString();

          // 1) Authoritative: close the dining_sessions row. Its Realtime UPDATE
          //    event is what the customer's browser subscribes to.
          let diningClosed = 0;
          let resolvedLegacySessionId: string | null = sessionId || null;
          if (diningSessionId) {
            const q = supabaseAdmin
              .from("dining_sessions")
              .update({ status: "closed", closed_at: closedAt })
              .eq("id", diningSessionId)
              .eq("restaurant_id", restaurantId);
            const { data: dsRows, error: dsErr } = customerToken
              ? await q.eq("customer_token", customerToken).select("id, legacy_table_session_id")
              : await q.select("id, legacy_table_session_id");
            if (dsErr) console.error("[FC-TABLE-CLOSED] dining_sessions update error:", dsErr);
            diningClosed = dsRows?.length ?? 0;
            if (!resolvedLegacySessionId && dsRows?.[0]?.legacy_table_session_id) {
              resolvedLegacySessionId = dsRows[0].legacy_table_session_id as string;
            }
          }

          // 2) Mirror closure into legacy table_sessions so any code still
          //    reading it (kitchen totals, admin views) stays consistent.
          let sessionsUpdated = 0;
          if (resolvedLegacySessionId) {
            const { data: updatedSessions, error: updateError } = await supabaseAdmin
              .from("table_sessions")
              .update({ status: "closed", closed_at: closedAt })
              .eq("id", resolvedLegacySessionId)
              .eq("restaurant_id", restaurantId)
              .select("id");
            if (updateError) console.error("[FC-TABLE-CLOSED] sessions update error:", updateError);
            sessionsUpdated = updatedSessions?.length ?? 0;

            if (sessionsUpdated > 0) {
              await supabaseAdmin
                .from("table_close_requests")
                .update({ status: "acknowledged", acknowledged_at: closedAt })
                .eq("restaurant_id", restaurantId)
                .eq("table_session_id", resolvedLegacySessionId)
                .eq("status", "pending");
            }
          }

          console.log("[FC-TABLE-CLOSED]", {
            restaurantId,
            dining_session_id: diningSessionId,
            legacy_session_id: resolvedLegacySessionId,
            table_number: body.table_number ?? null,
            diningClosed,
            sessionsUpdated,
          });

          return new Response(
            JSON.stringify({ success: true, dining_sessions_updated: diningClosed, sessions_updated: sessionsUpdated }),
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