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

          if (!body?.restaurant_id || (!body?.table_id && !body?.table_token)) {
            return new Response(
              JSON.stringify({ success: false, error: "Dados incompletos" }),
              { status: 400, headers },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Validate restaurant
          const { data: r } = await supabaseAdmin
            .from("restaurants")
            .select("id")
            .eq("id", body.restaurant_id)
            .maybeSingle();
          if (!r) {
            return new Response(
              JSON.stringify({ success: false, error: "Estabelecimento não encontrado" }),
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
          const { data: table } = await tableQuery.maybeSingle();

          if (!table || table.restaurant_id !== body.restaurant_id || !table.is_active) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Não foi possível solicitar o fechamento. Procure um atendente.",
              }),
              { status: 400, headers },
            );
          }

          // Resolve open session
          let session: any = null;
          if (body.table_session_id) {
            const { data } = await supabaseAdmin
              .from("table_sessions")
              .select("id, status, total_amount, table_id, restaurant_id")
              .eq("id", body.table_session_id)
              .maybeSingle();
            session = data;
          }
          if (!session) {
            const { data } = await supabaseAdmin
              .from("table_sessions")
              .select("id, status, total_amount, table_id, restaurant_id, opened_at")
              .eq("table_id", table.id)
              .eq("status", "open")
              .order("opened_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            session = data;
          }

          if (!session || session.status !== "open" || session.restaurant_id !== body.restaurant_id) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Não foi possível solicitar o fechamento. Procure um atendente.",
              }),
              { status: 400, headers },
            );
          }

          // Duplicate check
          const { data: existing } = await supabaseAdmin
            .from("table_close_requests")
            .select("id, status, requested_at")
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

          // Count orders linked to session
          const { count: orderCount } = await supabaseAdmin
            .from("table_session_orders")
            .select("order_id", { count: "exact", head: true })
            .eq("table_session_id", session.id);

          const ip =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            null;

          const { data: inserted, error: insErr } = await supabaseAdmin
            .from("table_close_requests")
            .insert({
              restaurant_id: body.restaurant_id,
              table_id: table.id,
              table_number: table.table_number,
              table_session_id: session.id,
              current_total: Number(session.total_amount ?? 0),
              order_count: orderCount ?? 0,
              customer_name: body.customer_name ?? null,
              customer_phone: body.customer_phone ?? null,
              status: "pending",
              requested_by_ip: ip,
            })
            .select()
            .single();

          if (insErr || !inserted) {
            // Race condition fallback: re-check duplicate
            const { data: again } = await supabaseAdmin
              .from("table_close_requests")
              .select("id")
              .eq("table_session_id", session.id)
              .eq("status", "pending")
              .maybeSingle();
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
            console.error("[TABLE-CLOSE-REQUEST] insert error", insErr);
            return new Response(
              JSON.stringify({ success: false, error: "Erro ao criar solicitação" }),
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
          console.error("[TABLE-CLOSE-REQUEST] Error:", e);
          return new Response(
            JSON.stringify({ success: false, error: "Erro interno" }),
            { status: 500, headers },
          );
        }
      },
    },
  },
});