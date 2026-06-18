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
  if (origin && isLovablePreview) allowOrigin = origin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export const Route = createFileRoute("/api/public/table-close-request")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { headers: getCorsHeaders(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };
        const log = (...args: any[]) => console.log("[TABLE-CLOSE-REQUEST]", ...args);
        try {
          const body = (await request.json()) as {
            restaurant_id?: string;
            table_id?: string;
            table_token?: string;
            table_number?: string;
            table_session_id?: string | null;
            customer_name?: string | null;
            customer_phone?: string | null;
          };

          log("incoming", {
            restaurant_id: body?.restaurant_id,
            table_id: body?.table_id,
            table_token: body?.table_token ? "***" : null,
            table_number: body?.table_number,
            table_session_id: body?.table_session_id,
            customer_name: body?.customer_name,
          });

          if (!body?.restaurant_id || (!body?.table_id && !body?.table_token)) {
            log("reject: missing restaurant_id or table identifier");
            return new Response(
              JSON.stringify({ success: false, code: "missing_fields", error: "Dados incompletos para solicitar o fechamento." }),
              { status: 400, headers },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Validate restaurant
          const { data: r, error: rErr } = await supabaseAdmin
            .from("restaurants")
            .select("id")
            .eq("id", body.restaurant_id)
            .maybeSingle();
          if (rErr) log("restaurant lookup error", rErr);
          if (!r) {
            log("reject: restaurant not found", body.restaurant_id);
            return new Response(
              JSON.stringify({ success: false, code: "restaurant_not_found", error: "Estabelecimento não encontrado." }),
              { status: 404, headers },
            );
          }

          // Resolve table by id or token, ensure it belongs to restaurant
          let tableQuery = supabaseAdmin
            .from("restaurant_tables")
            .select("id, table_number, restaurant_id, is_active");
          tableQuery = body.table_id
            ? tableQuery.eq("id", body.table_id)
            : tableQuery.eq("public_token", body.table_token!);
          const { data: table, error: tErr } = await tableQuery.maybeSingle();
          if (tErr) log("table lookup error", tErr);

          if (!table) {
            log("reject: table not found", { id: body.table_id, token: !!body.table_token });
            return new Response(
              JSON.stringify({ success: false, code: "table_not_found", error: "Mesa não encontrada." }),
              { status: 404, headers },
            );
          }
          if (table.restaurant_id !== body.restaurant_id) {
            log("reject: table belongs to different restaurant", { tableRest: table.restaurant_id, bodyRest: body.restaurant_id });
            return new Response(
              JSON.stringify({ success: false, code: "table_restaurant_mismatch", error: "Mesa não pertence a este estabelecimento." }),
              { status: 400, headers },
            );
          }
          if (!table.is_active) {
            log("reject: table inactive", table.id);
            return new Response(
              JSON.stringify({ success: false, code: "table_inactive", error: "Mesa inativa. Procure um atendente." }),
              { status: 400, headers },
            );
          }

          // Resolve open session
          let session: any = null;
          let sessionLookupErr: any = null;
          if (body.table_session_id) {
            const { data, error } = await supabaseAdmin
              .from("table_sessions")
              .select("id, status, total_amount, table_id, restaurant_id")
              .eq("id", body.table_session_id)
              .maybeSingle();
            if (error) sessionLookupErr = error;
            session = data;
          }
          if (!session) {
            const { data, error } = await supabaseAdmin
              .from("table_sessions")
              .select("id, status, total_amount, table_id, restaurant_id, opened_at")
              .eq("table_id", table.id)
              .eq("status", "open")
              .order("opened_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (error) sessionLookupErr = error;
            session = data;
          }
          if (sessionLookupErr) log("session lookup error", sessionLookupErr);
          log("session resolved", session ? { id: session.id, status: session.status, total: session.total_amount } : null);

          // If a session exists but is not open or belongs to another restaurant, reject.
          if (session && (session.status !== "open" || session.restaurant_id !== body.restaurant_id)) {
            log("reject: session not open or mismatched", {
              status: session.status,
              sessionRest: session.restaurant_id,
              bodyRest: body.restaurant_id,
            });
            return new Response(
              JSON.stringify({ success: false, code: "session_not_open", error: "Sessão da mesa não está aberta." }),
              { status: 400, headers },
            );
          }
          // NOTE: it's valid to request a close BEFORE any order was placed
          // (no session yet). In that case session = null and we still create
          // the request linked to the table only.

          // Duplicate check (by session if we have one, otherwise by table)
          const dupQuery = supabaseAdmin
            .from("table_close_requests")
            .select("id, status, requested_at")
            .eq("status", "pending");
          const { data: existing, error: dupErr } = await (session
            ? dupQuery.eq("table_session_id", session.id)
            : dupQuery.is("table_session_id", null).eq("table_id", table.id)
          ).maybeSingle();
          if (dupErr) log("duplicate lookup error", dupErr);

          if (existing) {
            log("duplicate request", existing.id);
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

          // Count orders linked to session (0 if no session yet)
          let orderCount = 0;
          if (session) {
            const { count, error: cErr } = await supabaseAdmin
              .from("table_session_orders")
              .select("order_id", { count: "exact", head: true })
              .eq("table_session_id", session.id);
            if (cErr) log("order count error", cErr);
            orderCount = count ?? 0;
          }

          const ip =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            null;

          const insertPayload = {
            restaurant_id: body.restaurant_id,
            table_id: table.id,
            table_number: table.table_number,
            table_session_id: session?.id ?? null,
            current_total: Number(session?.total_amount ?? 0),
            order_count: orderCount,
            customer_name: body.customer_name ?? null,
            customer_phone: body.customer_phone ?? null,
            status: "pending",
            requested_by_ip: ip,
          };
          log("inserting close request", insertPayload);

          const { data: inserted, error: insErr } = await supabaseAdmin
            .from("table_close_requests")
            .insert(insertPayload)
            .select()
            .single();

          if (insErr || !inserted) {
            log("insert error", insErr);
            // Race condition fallback: re-check duplicate
            const againQ = supabaseAdmin
              .from("table_close_requests")
              .select("id")
              .eq("status", "pending");
            const { data: again } = await (session
              ? againQ.eq("table_session_id", session.id)
              : againQ.is("table_session_id", null).eq("table_id", table.id)
            ).maybeSingle();
            if (again) {
              return new Response(
                JSON.stringify({
                  success: true,
                  duplicate: true,
                  request_id: again.id,
                  message: "Uma solicitação de fechamento já foi enviada.",
                }),
                { status: 200, headers },
              );
            }
            return new Response(
              JSON.stringify({
                success: false,
                code: "insert_failed",
                error: insErr?.message || "Erro ao criar solicitação.",
                details: insErr ?? null,
              }),
              { status: 500, headers },
            );
          }

          log("inserted", inserted.id);

          return new Response(
            JSON.stringify({
              success: true,
              request_id: inserted.id,
              event: {
                event: "table_close_request",
                restaurant_id: inserted.restaurant_id,
                store_id: inserted.restaurant_id,
                table_id: inserted.table_id,
                table_number: inserted.table_number,
                session_id: inserted.table_session_id,
                current_total: Number(inserted.current_total),
                order_count: inserted.order_count,
                requested_at: inserted.requested_at,
                status: inserted.status,
              },
            }),
            { status: 201, headers },
          );
        } catch (e: any) {
          console.error("[TABLE-CLOSE-REQUEST] Unhandled error:", e?.message, e?.stack);
          return new Response(
            JSON.stringify({ success: false, code: "internal_error", error: e?.message || "Erro interno." }),
            { status: 500, headers },
          );
        }
      },
    },
  },
});