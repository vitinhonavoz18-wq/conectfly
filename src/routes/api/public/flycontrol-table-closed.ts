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

          const payloadRestaurantId = body?.restaurant_id?.trim() || null;
          const sessionId = body?.session_id?.trim() || null;
          const diningSessionId = body?.dining_session_id?.trim() || null;
          const customerToken = body?.customer_token?.trim() || null;

          if (!diningSessionId && !customerToken && !sessionId) {
            return new Response(
              JSON.stringify({ success: false, error: "dining_session_id, customer_token or session_id is required" }),
              { status: 400, headers },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const closedAt = body.closed_at ?? new Date().toISOString();

          // ------------------------------------------------------------------
          // AUTHORITATIVE RESOLUTION
          // The dining_session row is the source of truth. Resolve it FIRST
          // by its own primary key (or fallbacks), then use ITS restaurant_id
          // — NEVER the payload's — for all subsequent UPDATEs. FlyControl has
          // been known to send a mismatched restaurant_id.
          // ------------------------------------------------------------------
          type DsRow = {
            id: string;
            restaurant_id: string;
            legacy_table_session_id: string | null;
            customer_token: string | null;
          };
          let dsRow: DsRow | null = null;

          if (diningSessionId) {
            const { data, error } = await supabaseAdmin
              .from("dining_sessions")
              .select("id, restaurant_id, legacy_table_session_id, customer_token")
              .eq("id", diningSessionId)
              .maybeSingle();
            if (error) console.error("[FC-TABLE-CLOSED] ds lookup by id error:", error);
            dsRow = (data as DsRow | null) ?? null;
          }

          // Fallback 1: customer_token (accept active OR requested_close)
          if (!dsRow && customerToken) {
            const { data, error } = await supabaseAdmin
              .from("dining_sessions")
              .select("id, restaurant_id, legacy_table_session_id, customer_token")
              .eq("customer_token", customerToken)
              .in("status", ["active", "requested_close"])
              .order("opened_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (error) console.error("[FC-TABLE-CLOSED] ds lookup by customer_token error:", error);
            dsRow = (data as DsRow | null) ?? null;
          }

          // Fallback 2: legacy session_id
          if (!dsRow && sessionId) {
            const { data, error } = await supabaseAdmin
              .from("dining_sessions")
              .select("id, restaurant_id, legacy_table_session_id, customer_token")
              .eq("legacy_table_session_id", sessionId)
              .order("opened_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (error) console.error("[FC-TABLE-CLOSED] ds lookup by legacy id error:", error);
            dsRow = (data as DsRow | null) ?? null;
          }

          if (!dsRow) {
            console.warn("[FC-TABLE-CLOSED] session_not_found", {
              payload_restaurant_id: payloadRestaurantId,
              dining_session_id: diningSessionId,
              customer_token: customerToken,
              session_id: sessionId,
            });
            return new Response(
              JSON.stringify({
                success: false,
                error: "session_not_found",
                dining_sessions_updated: 0,
                sessions_updated: 0,
              }),
              { status: 404, headers },
            );
          }

          // From now on ONLY the resolved row's restaurant_id matters.
          const authoritativeRestaurantId = dsRow.restaurant_id;
          const resolvedDiningSessionId = dsRow.id;
          const resolvedLegacySessionId = dsRow.legacy_table_session_id ?? sessionId ?? null;

          if (payloadRestaurantId && payloadRestaurantId !== authoritativeRestaurantId) {
            console.warn("[FC-TABLE-CLOSED] restaurant_id mismatch — using authoritative", {
              payload_restaurant_id: payloadRestaurantId,
              authoritative_restaurant_id: authoritativeRestaurantId,
              dining_session_id: resolvedDiningSessionId,
            });
          }

          // 1) Close dining_sessions (authoritative). Realtime UPDATE fires here.
          const { data: dsUpdated, error: dsUpdateErr } = await supabaseAdmin
            .from("dining_sessions")
            .update({ status: "closed", closed_at: closedAt })
            .eq("id", resolvedDiningSessionId)
            .eq("restaurant_id", authoritativeRestaurantId)
            .select("id");
          if (dsUpdateErr) console.error("[FC-TABLE-CLOSED] dining_sessions update error:", dsUpdateErr);
          const diningClosed = dsUpdated?.length ?? 0;

          // 2) Mirror closure into legacy table_sessions.
          let sessionsUpdated = 0;
          if (resolvedLegacySessionId) {
            const { data: updatedSessions, error: updateError } = await supabaseAdmin
              .from("table_sessions")
              .update({ status: "closed", closed_at: closedAt })
              .eq("id", resolvedLegacySessionId)
              .eq("restaurant_id", authoritativeRestaurantId)
              .select("id");
            if (updateError) console.error("[FC-TABLE-CLOSED] sessions update error:", updateError);
            sessionsUpdated = updatedSessions?.length ?? 0;
          }

          // 3) Acknowledge pending close requests.
          let closeRequestsUpdated = 0;
          {
            const { data: ackByDining, error: ackErr1 } = await supabaseAdmin
              .from("table_close_requests")
              .update({ status: "acknowledged", acknowledged_at: closedAt })
              .eq("restaurant_id", authoritativeRestaurantId)
              .eq("dining_session_id", resolvedDiningSessionId)
              .eq("status", "pending")
              .select("id");
            if (ackErr1) console.error("[FC-TABLE-CLOSED] close_requests (dining) update error:", ackErr1);
            closeRequestsUpdated += ackByDining?.length ?? 0;

            if (resolvedLegacySessionId) {
              const { data: ackByLegacy, error: ackErr2 } = await supabaseAdmin
                .from("table_close_requests")
                .update({ status: "acknowledged", acknowledged_at: closedAt })
                .eq("restaurant_id", authoritativeRestaurantId)
                .eq("table_session_id", resolvedLegacySessionId)
                .eq("status", "pending")
                .select("id");
              if (ackErr2) console.error("[FC-TABLE-CLOSED] close_requests (legacy) update error:", ackErr2);
              closeRequestsUpdated += ackByLegacy?.length ?? 0;
            }
          }

          console.log("[FC-TABLE-CLOSED]", {
            payload_restaurant_id: payloadRestaurantId,
            authoritative_restaurant_id: authoritativeRestaurantId,
            dining_session_id: resolvedDiningSessionId,
            legacy_session_id: resolvedLegacySessionId,
            table_number: body.table_number ?? null,
            diningClosed,
            sessionsUpdated,
            closeRequestsUpdated,
          });

          if (diningClosed === 0 && sessionsUpdated === 0) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "no_rows_updated",
                dining_sessions_updated: 0,
                sessions_updated: 0,
                close_requests_updated: closeRequestsUpdated,
              }),
              { status: 409, headers },
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              dining_sessions_updated: diningClosed,
              sessions_updated: sessionsUpdated,
              close_requests_updated: closeRequestsUpdated,
            }),
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