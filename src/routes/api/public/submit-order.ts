import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function joinUrl(base: string, path: string) {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

function resolveOrdersUrl(restaurant: {
  flycontrol_api_url: string | null;
  flycontrol_base_url: string | null;
}): string {
  let specific = (restaurant.flycontrol_api_url ?? "").trim();
  let base = (restaurant.flycontrol_base_url ?? "").trim();
  const isTest = /test|connection|check|ping/i.test(specific);
  if (base && isTest) specific = "";
  if (specific) {
    if (
      !specific.includes("/orders") &&
      !specific.includes("/create-order") &&
      !specific.includes("/functions/v1/")
    ) {
      base = specific;
      specific = "";
    } else {
      return specific;
    }
  }
  if (!base) return "";
  if (!base.startsWith("http")) base = "https://" + base;
  base = base.replace(/\/+$/, "");
  if (base.includes(".supabase.co")) return joinUrl(base, "functions/v1/create-order");
  return joinUrl(base, "api/orders");
}

export const Route = createFileRoute("/api/public/submit-order")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            restaurant_id?: string;
            payload?: any;
          };
          if (!body?.restaurant_id || !body?.payload) {
            return new Response(
              JSON.stringify({ success: false, error: "restaurant_id e payload obrigatórios" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          const { data: r, error } = await supabaseAdmin
            .from("restaurants")
            .select("id, flycontrol_enabled, flycontrol_api_url, flycontrol_api_key, flycontrol_base_url")
            .eq("id", body.restaurant_id)
            .maybeSingle();

          if (error || !r) {
            return new Response(
              JSON.stringify({ success: false, error: "Pizzaria não encontrada" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          if (!r.flycontrol_enabled) {
            return new Response(
              JSON.stringify({ success: true, skipped: true, reason: "flycontrol disabled" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          const url = resolveOrdersUrl(r);
          const key = (r.flycontrol_api_key ?? "").trim();
          if (!url || !key) {
            return new Response(
              JSON.stringify({ success: false, error: "Integração FlyControl incompleta" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          const idempotencyKey =
            request.headers.get("x-idempotency-key") || body.payload?.order?.id || "";

          // Forward com retry/backoff
          const maxRetries = 3;
          let lastErr = "";
          let lastStatus = 0;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const res = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": key,
                  "x-idempotency-key": idempotencyKey,
                  Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({ ...body.payload, api_key: key }),
              });
              const txt = await res.text().catch(() => "");
              let data: any = {};
              try { data = JSON.parse(txt); } catch { data = { text: txt }; }
              if (!res.ok) {
                lastErr = `FLYCONTROL ${res.status}: ${txt || res.statusText}`;
                lastStatus = res.status;
                if (res.status >= 400 && res.status < 500) break; // não retry em 4xx
              } else if (data.status === "error" || data.success === false) {
                lastErr = data.message || "Pedido rejeitado pelo FlyControl";
                break;
              } else {
                return new Response(
                  JSON.stringify({ success: true, data }),
                  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
              }
            } catch (e: any) {
              lastErr = e?.message || String(e);
            }
            if (attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
            }
          }

          return new Response(
            JSON.stringify({ success: false, error: lastErr, status: lastStatus }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({ success: false, error: e?.message || "internal error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});