import { createFileRoute } from "@tanstack/react-router";
import { buildCorsHeaders, preflightResponse } from "@/lib/cors";

const CORS_OPTS = { methods: "POST, OPTIONS" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/**
 * POST /api/public/request-close-table
 *
 * Pure customer-side request generator. The authoritative session identity is
 * (dining_session_id, customer_token); every other field is derived on the
 * server by looking up the dining_sessions row. Inserts a pending
 * `table_close_requests` row (which FlyControl subscribes to via Realtime).
 * No side effects on the dining session itself — closure is applied only by
 * the FlyControl webhook.
 */
export const Route = createFileRoute("/api/public/request-close-table")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflightResponse(request, CORS_OPTS),
      POST: async ({ request }) => {
        const headers: Record<string, string> = {
          ...buildCorsHeaders(request, CORS_OPTS),
          "Content-Type": "application/json",
        };
        const json = (v: unknown, status: number) =>
          new Response(JSON.stringify(v), { status, headers });

        let body: {
          dining_session_id?: string;
          customer_token?: string;
          table_token?: string | null;
          customer_name?: string | null;
        };
        try {
          body = await request.json();
        } catch {
          return json({ success: false, error: "invalid_json" }, 400);
        }

        if (!isUuid(body?.dining_session_id) || !isUuid(body?.customer_token)) {
          return json(
            { success: false, error: "dining_session_id and customer_token are required", code: "missing_identity" },
            400,
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Resolve the active dining session by its authoritative identity.
        const { data: ds, error: dsErr } = await supabaseAdmin
          .from("dining_sessions")
          .select("id, restaurant_id, table_id, table_number, table_token, customer_token, status, closed_at")
          .eq("id", body.dining_session_id!)
          .maybeSingle();

        if (dsErr || !ds) {
          console.warn("[request-close-table] dining session not found", { id: body.dining_session_id, err: dsErr });
          return json({ success: false, error: "dining_session_not_found", code: "not_found" }, 404);
        }
        if (ds.customer_token !== body.customer_token) {
          return json({ success: false, error: "customer_token_mismatch", code: "unauthorized" }, 401);
        }
        if (ds.status !== "active" || ds.closed_at) {
          return json(
            { success: false, error: "dining_session_not_active", code: "not_active", status: ds.status },
            409,
          );
        }

        // 2. Ensure a local restaurant_tables row exists so the FK is satisfied.
        let tableId: string | null = ds.table_id ?? null;
        if (!tableId) {
          const tokenForLookup = ds.table_token ?? body.table_token ?? null;
          if (tokenForLookup) {
            const { data: t } = await supabaseAdmin
              .from("restaurant_tables")
              .select("id")
              .eq("restaurant_id", ds.restaurant_id)
              .eq("public_token", tokenForLookup)
              .maybeSingle();
            if (t) tableId = t.id;
            if (!tableId) {
              const { data: created } = await supabaseAdmin
                .from("restaurant_tables")
                .upsert(
                  {
                    restaurant_id: ds.restaurant_id,
                    table_number: ds.table_number || "QR",
                    public_token: tokenForLookup,
                    is_active: true,
                  },
                  { onConflict: "public_token" },
                )
                .select("id")
                .maybeSingle();
              tableId = created?.id ?? null;
            }
          }
        }
        if (!tableId) {
          return json({ success: false, error: "table_not_resolved", code: "table_missing" }, 409);
        }

        // 3. Dedup — one pending request per dining session.
        const { data: existing } = await supabaseAdmin
          .from("table_close_requests")
          .select("id")
          .eq("dining_session_id", ds.id)
          .eq("status", "pending")
          .maybeSingle();
        if (existing) {
          return json(
            { success: true, duplicate: true, request_id: existing.id, code: "already_pending" },
            200,
          );
        }

        // 3b. Auto-acknowledge orphan pending rows for this table that belong
        // to a different / missing session. Otherwise the partial unique index
        // `uniq_tcr_pending_per_table` (table_id WHERE status='pending' AND
        // table_session_id IS NULL) would block the INSERT below with a
        // duplicate-key error and the customer would be stuck forever.
        const { data: orphans } = await supabaseAdmin
          .from("table_close_requests")
          .select("id, dining_session_id, table_session_id")
          .eq("table_id", tableId)
          .eq("status", "pending");
        const orphanIds: string[] = [];
        for (const row of orphans ?? []) {
          if (row.dining_session_id === ds.id) continue; // belongs to active session
          if (!row.dining_session_id || !row.table_session_id) {
            orphanIds.push(row.id);
            continue;
          }
          // Both ids set but not our session — orphan if either referenced
          // session is no longer live.
          const [{ data: refDs }, { data: refTs }] = await Promise.all([
            supabaseAdmin
              .from("dining_sessions")
              .select("id, status")
              .eq("id", row.dining_session_id)
              .maybeSingle(),
            supabaseAdmin
              .from("table_sessions")
              .select("id, status")
              .eq("id", row.table_session_id)
              .maybeSingle(),
          ]);
          const diningLive = refDs && (refDs.status === "active" || refDs.status === "requested_close");
          const tableLive = refTs && refTs.status === "open";
          if (!diningLive || !tableLive) orphanIds.push(row.id);
        }
        if (orphanIds.length > 0) {
          const { error: ackErr } = await supabaseAdmin
            .from("table_close_requests")
            .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
            .in("id", orphanIds);
          if (ackErr) console.warn("[request-close-table] orphan ack failed", ackErr);
        }

        // 4. Insert the pending request. FlyControl receives it via Realtime.
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("table_close_requests")
          .insert({
            restaurant_id: ds.restaurant_id,
            table_id: tableId,
            table_number: ds.table_number,
            dining_session_id: ds.id,
            customer_token: ds.customer_token,
            customer_name: body.customer_name ?? null,
            current_total: 0,
            status: "pending",
          })
          .select("id, requested_at, status")
          .single();

        if (insErr || !inserted) {
          console.error("[request-close-table] insert failed", insErr);
          return json({ success: false, error: insErr?.message || "insert_failed", code: "insert_failed" }, 500);
        }

        return json(
          {
            success: true,
            request_id: inserted.id,
            status: inserted.status,
            requested_at: inserted.requested_at,
          },
          201,
        );
      },
    },
  },
});
