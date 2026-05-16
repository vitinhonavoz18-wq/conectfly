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

function isInvalidUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  // Only HTTPS to public hosts is allowed.
  if (parsed.protocol !== "https:") return true;
  const host = parsed.hostname.toLowerCase();
  if (!host) return true;

  // Block localhost / loopback / internal hostnames
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) return true;

  // Block raw IPv6 literals (covers ::1 and ULA fc00::/7, link-local fe80::/10)
  if (host.startsWith("[")) return true;

  // If hostname is an IPv4 literal, block private / loopback / link-local ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast / reserved
    ) return true;
  }

  return false;
}

function resolveOrdersUrl(restaurant: {
  flycontrol_api_url: string | null;
  flycontrol_base_url: string | null;
}): string {
  let specific = (restaurant.flycontrol_api_url ?? "").trim();
  let base = (restaurant.flycontrol_base_url ?? "").trim();

  if (specific) {
    if (!specific.startsWith("http")) specific = "https://" + specific;
    if (isInvalidUrl(specific)) return "";
    return specific;
  }
  if (!base) return "";
  if (!base.startsWith("http")) base = "https://" + base;
  if (isInvalidUrl(base)) return "";
  
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
          const ip = request.headers.get("x-forwarded-for") || "unknown";
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

          // Rate limiting
          const { data: allowed, error: limitErr } = await supabaseAdmin.rpc("check_order_rate_limit", {
            p_restaurant_id: body.restaurant_id,
            p_ip: ip
          });

          if (limitErr || allowed === false) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente." 
              }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

           const idempotencyKey = request.headers.get("x-idempotency-key") || body.payload?.order?.id || "";
           const maxRetries = 3;
           let lastErr = "";
           let lastStatus = 0;
           let finalData: any = null;
           let isSuccess = false;
 
           for (let attempt = 0; attempt <= maxRetries; attempt++) {
             try {
               const res = await fetch(url, {
                 method: "POST",
                 headers: {
                   "Content-Type": "application/json",
                   "x-api-key": key,
                   "x-idempotency-key": idempotencyKey,
                  },
                   body: JSON.stringify(body.payload),
               });
               const txt = await res.text().catch(() => "");
               try { finalData = JSON.parse(txt); } catch { finalData = { text: txt }; }
               lastStatus = res.status;
 
               if (res.ok && finalData.status !== "error" && finalData.success !== false) {
                 isSuccess = true;
                 break;
               }
 
               lastErr = !res.ok ? `FLYCONTROL ${res.status}: ${txt || res.statusText}` : (finalData.message || "Pedido rejeitado");
               if (res.status >= 400 && res.status < 500) break;
             } catch (e: any) {
               lastErr = e?.message || String(e);
             }
             if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
           }
 
           await supabaseAdmin.from("flycontrol_order_logs").insert({
             restaurant_id: body.restaurant_id,
             idempotency_key: idempotencyKey,
             payload: body.payload,
             status_code: lastStatus,
             success: isSuccess,
             error_message: isSuccess ? null : lastErr,
             response_body: finalData ? JSON.stringify(finalData) : null,
           });
 
           return new Response(JSON.stringify({ success: isSuccess, data: finalData, error: isSuccess ? null : lastErr }), {
             status: isSuccess ? 200 : 502,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
           });
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