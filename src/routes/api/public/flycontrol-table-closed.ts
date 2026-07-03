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

          if (!sessionId && !diningSessionId && !customerToken) {
            return new Response(
              JSON.stringify({ success: false, error: "dining_session_id or customer_token is required" }),
              { status: 400, headers },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const closedAt = body.closed_at ?? new Date().toISOString();

          // 1) Authoritative: close the dining_sessions row. Its Realtime UPDATE
          //    event is what the customer's browser subscribes to.
          //    Lookup order: dining_session_id → customer_token. Never table_number.
          let diningClosed = 0;
          let resolvedDiningSessionId: string | null = diningSessionId || null;
          let resolvedLegacySessionId: string | null = sessionId || null;
          {
            let q = supabaseAdmin
              .from("dining_sessions")
              .update({ status: "closed", closed_at: closedAt })
              .eq("restaurant_id", restaurantId);
            if (diningSessionId) {
              q = q.eq("id", diningSessionId);
              if (customerToken) q = q.eq("customer_token", customerToken);
            } else if (customerToken) {
              // Fallback: match by customer_token only. Accept both active
              // and requested_close so the operator confirmation always
              // succeeds regardless of the intermediate state.
              q = q.eq("customer_token", customerToken).in("status", ["active", "requested_close"]);
            } else {
              // Nothing usable; skip dining_sessions close and fail below.
              q = q.eq("id", "00000000-0000-0000-0000-000000000000");
            }
            const { data: dsRows, error: dsErr } = await q.select("id, legacy_table_session_id");
            if (dsErr) console.error("[FC-TABLE-CLOSED] dining_sessions update error:", dsErr);
            diningClosed = dsRows?.length ?? 0;
            if (dsRows?.[0]?.id) resolvedDiningSessionId = dsRows[0].id as string;
            if (!resolvedLegacySessionId && dsRows?.[0]?.legacy_table_session_id) {
              resolvedLegacySessionId = dsRows[0].legacy_table_session_id as string;
            }
          }

          // 2) Mirror closure into legacy table_sessions so any code still
          //    reading it (kitchen totals, admin views) stays consistent.
          //    table_sessions is a FL compatibility mirror ONLY — never used
          //    as customer authority.
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
          }

          // 3) Acknowledge any pending close request — by dining_session_id
          //    first, then by legacy session id as fallback.
          if (resolvedDiningSessionId) {
            await supabaseAdmin
              .from("table_close_requests")
              .update({ status: "acknowledged", acknowledged_at: closedAt })
              .eq("restaurant_id", restaurantId)
              .eq("dining_session_id", resolvedDiningSessionId)
              .eq("status", "pending");
          } else if (resolvedLegacySessionId) {
            await supabaseAdmin
              .from("table_close_requests")
              .update({ status: "acknowledged", acknowledged_at: closedAt })
              .eq("restaurant_id", restaurantId)
              .eq("table_session_id", resolvedLegacySessionId)
              .eq("status", "pending");
          }

          console.log("[FC-TABLE-CLOSED]", {
            restaurantId,
            dining_session_id: resolvedDiningSessionId,
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