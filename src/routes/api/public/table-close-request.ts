import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/**
 * Table Close Request — minimal, single responsibility.
 * Validates table + active session, then inserts a pending row.
 * Realtime publication on `table_close_requests` handles delivery to FlyControl.
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
            customer_name?: string | null;
          };

          if (!body?.restaurant_id || (!body?.table_id && !body?.table_token)) {
            return new Response(
              JSON.stringify({ success: false, error: "Dados incompletos." }),
              { status: 400, headers },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 1. Resolve table (by id or QR token) and ensure it belongs to restaurant.
          const tQ = supabaseAdmin
            .from("restaurant_tables")
            .select("id, table_number, restaurant_id, is_active")
            .eq("restaurant_id", body.restaurant_id);
          const { data: table } = await (body.table_id
            ? tQ.eq("id", body.table_id)
            : tQ.eq("public_token", body.table_token!)
          ).maybeSingle();

          if (!table || !table.is_active) {
            return new Response(
              JSON.stringify({ success: false, error: "Mesa não encontrada ou inativa." }),
              { status: 404, headers },
            );
          }

          // 2. Locate the active (open) session for this table.
          const { data: session } = await supabaseAdmin
            .from("table_sessions")
            .select("id, total_amount")
            .eq("table_id", table.id)
            .eq("restaurant_id", body.restaurant_id)
            .eq("status", "open")
            .order("opened_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!session) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Nenhuma sessão ativa nesta mesa. Faça um pedido antes de solicitar o fechamento.",
              }),
              { status: 400, headers },
            );
          }

          // 3. Duplicate protection — one pending request per session.
          const { data: existing } = await supabaseAdmin
            .from("table_close_requests")
            .select("id")
            .eq("table_session_id", session.id)
            .eq("status", "pending")
            .maybeSingle();

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

          // 4. Insert pending request (Realtime publication delivers to FlyControl).
          const { data: inserted, error: insErr } = await supabaseAdmin
            .from("table_close_requests")
            .insert({
              restaurant_id: body.restaurant_id,
              table_id: table.id,
              table_number: table.table_number,
              table_session_id: session.id,
              current_total: Number(session.total_amount ?? 0),
              customer_name: body.customer_name ?? null,
              status: "pending",
            })
            .select()
            .single();

          if (insErr || !inserted) {
            // Race: another request landed first.
            const { data: again } = await supabaseAdmin
              .from("table_close_requests")
              .select("id")
              .eq("table_session_id", session.id)
              .eq("status", "pending")
              .maybeSingle();
            if (again) {
              return new Response(
                JSON.stringify({ success: true, duplicate: true, request_id: again.id }),
                { status: 200, headers },
              );
            }
            log("insert error", insErr);
            return new Response(
              JSON.stringify({ success: false, error: insErr?.message || "Erro ao criar solicitação." }),
              { status: 500, headers },
            );
          }

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
            JSON.stringify({ success: false, error: e?.message || "Erro interno." }),
            { status: 500, headers },
          );
        }
      },
    },
  },
});