import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/**
 * Table Close Request — minimal, single responsibility.
 *
 * The runtime reality is that tables and sessions are owned by FlyControl;
 * the local `restaurant_tables` / `table_sessions` rows may not exist when a
 * customer reaches the "Fechar Mesa" button (no QR-scan-side hydration).
 *
 * Resolution rules:
 *   1. table_id is only trusted when it is a real UUID (the client may send
 *      sentinel strings like "flycontrol-table").
 *   2. Otherwise we look up by `public_token` (the value embedded in the QR).
 *   3. If no local row exists, we upsert one from the supplied token + number
 *      so the close-request FK can be satisfied without losing audit data.
 *   4. Local `table_sessions` is best-effort: a missing session is logged and
 *      the request is still created (deduped via `uniq_tcr_pending_per_table`).
 */
export const Route = createFileRoute("/api/public/table-close-request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: CORS }),
      POST: async ({ request }) => {
        const headers = { ...CORS, "Content-Type": "application/json" };
        const log = (...a: any[]) => console.log("[TABLE-CLOSE-REQUEST]", ...a);

        try {
          const body = (await request.json().catch(() => ({}))) as {
            restaurant_id?: string;
            table_id?: string;
            table_token?: string;
            table_number?: string;
            table_session_id?: string | null;
            customer_name?: string | null;
          };

          log("incoming", {
            restaurant_id: body?.restaurant_id,
            table_id: body?.table_id,
            table_id_is_uuid: isUuid(body?.table_id),
            table_token: body?.table_token,
            table_number: body?.table_number,
            table_session_id: body?.table_session_id,
            table_session_id_is_uuid: isUuid(body?.table_session_id),
          });

          if (!body?.restaurant_id || (!body?.table_token && !isUuid(body?.table_id))) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Dados incompletos: restaurant_id e table_token são obrigatórios.",
                code: "missing_fields",
              }),
              { status: 400, headers },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 1. Resolve table — by UUID id first, else by QR public_token.
          let table: { id: string; table_number: string; is_active: boolean } | null = null;

          if (isUuid(body.table_id)) {
            const { data, error } = await supabaseAdmin
              .from("restaurant_tables")
              .select("id, table_number, is_active")
              .eq("restaurant_id", body.restaurant_id)
              .eq("id", body.table_id!)
              .maybeSingle();
            if (error) log("lookup-by-id error", error);
            table = data ?? null;
          }

          if (!table && body.table_token) {
            const { data, error } = await supabaseAdmin
              .from("restaurant_tables")
              .select("id, table_number, is_active")
              .eq("restaurant_id", body.restaurant_id)
              .eq("public_token", body.table_token)
              .maybeSingle();
            if (error) log("lookup-by-token error", error);
            table = data ?? null;
          }

          // 2. If still missing, auto-create a local row from QR data so the
          //    FK on `table_close_requests.table_id` can be satisfied. Tables
          //    are FlyControl-owned in production, so the local row is a
          //    lightweight mirror used only for audit/realtime delivery.
          if (!table && body.table_token) {
            const number = (body.table_number ?? "").trim() || "QR";
            log("auto-creating local restaurant_tables row", {
              restaurant_id: body.restaurant_id,
              table_number: number,
              public_token: body.table_token,
            });
            const { data: created, error: upErr } = await supabaseAdmin
              .from("restaurant_tables")
              .upsert(
                {
                  restaurant_id: body.restaurant_id,
                  table_number: number,
                  public_token: body.table_token,
                  is_active: true,
                },
                { onConflict: "public_token" },
              )
              .select("id, table_number, is_active")
              .maybeSingle();
            if (upErr) log("auto-create error", upErr);
            table = created ?? null;
          }

          if (!table) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Mesa não localizada. Escaneie o QR Code novamente.",
                code: "table_not_found",
              }),
              { status: 404, headers },
            );
          }
          if (!table.is_active) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Mesa inativa.",
                code: "table_inactive",
              }),
              { status: 400, headers },
            );
          }

          // 3. Best-effort session lookup. We accept the supplied session_id
          //    only when it is a real local UUID. Otherwise we try to find the
          //    most recent open session for this table; if none exists we keep
          //    `table_session_id = null` and rely on the per-table dedup index.
          let sessionId: string | null = null;
          let currentTotal = 0;

          if (isUuid(body.table_session_id)) {
            const { data: s } = await supabaseAdmin
              .from("table_sessions")
              .select("id, total_amount, status")
              .eq("id", body.table_session_id!)
              .maybeSingle();
            if (s && s.status === "open") {
              sessionId = s.id;
              currentTotal = Number(s.total_amount ?? 0);
            } else {
              log("supplied session_id not open or missing", { supplied: body.table_session_id, found: s });
            }
          }

          if (!sessionId) {
            const { data: s } = await supabaseAdmin
              .from("table_sessions")
              .select("id, total_amount")
              .eq("table_id", table.id)
              .eq("restaurant_id", body.restaurant_id)
              .eq("status", "open")
              .order("opened_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (s) {
              sessionId = s.id;
              currentTotal = Number(s.total_amount ?? 0);
            } else {
              log("no open local session for table — proceeding with session_id=null", {
                table_id: table.id,
              });
            }
          }

          // 4. Duplicate protection — matches the partial unique indexes.
          const dupQuery = supabaseAdmin
            .from("table_close_requests")
            .select("id")
            .eq("status", "pending");
          const { data: existing } = await (sessionId
            ? dupQuery.eq("table_session_id", sessionId)
            : dupQuery.eq("table_id", table.id).is("table_session_id", null)
          ).maybeSingle();

          if (existing) {
            return new Response(
              JSON.stringify({
                success: true,
                duplicate: true,
                request_id: existing.id,
                message: "Uma solicitação de fechamento já foi enviada.",
              }),
              { status: 200, headers },
            );
          }

          // 5. Insert pending request (Realtime publication delivers to FlyControl).
          const { data: inserted, error: insErr } = await supabaseAdmin
            .from("table_close_requests")
            .insert({
              restaurant_id: body.restaurant_id,
              table_id: table.id,
              table_number: table.table_number,
              table_session_id: sessionId,
              current_total: currentTotal,
              customer_name: body.customer_name ?? null,
              status: "pending",
            })
            .select()
            .single();

          if (insErr || !inserted) {
            // Race: another request landed first.
            const againQuery = supabaseAdmin
              .from("table_close_requests")
              .select("id")
              .eq("status", "pending");
            const { data: again } = await (sessionId
              ? againQuery.eq("table_session_id", sessionId)
              : againQuery.eq("table_id", table.id).is("table_session_id", null)
            ).maybeSingle();
            if (again) {
              return new Response(
                JSON.stringify({ success: true, duplicate: true, request_id: again.id }),
                { status: 200, headers },
              );
            }
            log("insert error", insErr);
            return new Response(
              JSON.stringify({
                success: false,
                error: insErr?.message || "Erro ao criar solicitação.",
                code: "insert_failed",
              }),
              { status: 500, headers },
            );
          }

          log("created", { request_id: inserted.id, table_id: inserted.table_id, session_id: inserted.table_session_id });

          return new Response(
            JSON.stringify({
              success: true,
              request_id: inserted.id,
              event: {
                event: "table_close_request",
                restaurant_id: inserted.restaurant_id,
                table_id: inserted.table_id,
                table_number: inserted.table_number,
                session_id: inserted.table_session_id,
                current_total: Number(inserted.current_total),
                status: inserted.status,
                requested_at: inserted.requested_at,
              },
            }),
            { status: 201, headers },
          );
        } catch (e: any) {
          console.error("[TABLE-CLOSE-REQUEST] Unhandled:", e?.message, e?.stack);
          return new Response(
            JSON.stringify({ success: false, error: e?.message || "Erro interno.", code: "unhandled" }),
            { status: 500, headers },
          );
        }
      },
    },
  },
});