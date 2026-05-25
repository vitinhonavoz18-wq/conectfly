import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED_ORIGINS = [
  "https://conectfly.com.br",
  "https://www.conectfly.com.br",
  "https://conectfly.lovable.app",
];

function getCorsHeaders(origin: string | null) {
  let allowOrigin = ALLOWED_ORIGINS[0];
  
  // Permite origens oficiais ou qualquer preview do Lovable para facilitar desenvolvimento
  const isLovablePreview = origin && (
    origin.endsWith(".lovable.app") || 
    origin.includes("lovable.dev") ||
    ALLOWED_ORIGINS.includes(origin)
  );

  if (origin && isLovablePreview) {
    allowOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "content-type, x-idempotency-key, authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

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
      OPTIONS: async ({ request }) => new Response(null, { headers: getCorsHeaders(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };
        
        try {
          const ip = request.headers.get("x-forwarded-for") || "unknown";
          const body = (await request.json()) as {
            restaurant_id?: string;
            payload?: any;
            test?: boolean;
          };
          
          if (!body?.restaurant_id || (!body?.payload && !body?.test)) {
            return new Response(
              JSON.stringify({ success: false, error: "Dados incompletos" }),
              { status: 400, headers },
            );
          }

          const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRe.test(body.restaurant_id)) {
            return new Response(
              JSON.stringify({ success: false, error: "ID de restaurante inválido" }),
              { status: 400, headers },
            );
          }

          const { data: allowed, error: limitErr } = await supabaseAdmin.rpc("check_order_rate_limit", {
            p_restaurant_id: body.restaurant_id,
            p_ip: ip
          });

          if (limitErr || allowed === false) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "Muitas tentativas. Aguarde um pouco." 
              }),
              { status: 429, headers },
            );
          }

          const { data: r, error } = await supabaseAdmin
            .from("restaurants")
            .select("id, name, slug, flycontrol_enabled, flycontrol_api_url, flycontrol_api_key, flycontrol_base_url")
            .eq("id", body.restaurant_id)
            .maybeSingle();

          if (error || !r) {
            return new Response(
              JSON.stringify({ success: false, error: "Pizzaria não encontrada" }),
              { status: 404, headers },
            );
          }

          if (!r.flycontrol_enabled) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                skipped: true, 
                message: "Integração FlyControl desativada para esta pizzaria" 
              }),
              { status: 200, headers },
            );
          }

          const url = resolveOrdersUrl(r);
          const key = (r.flycontrol_api_key ?? "").trim();
          
          if (!url || !key) {
            console.error(`[SUBMIT-ORDER] Configuração incompleta para pizzaria ${body.restaurant_id}: url=${!!url}, key=${!!key}`);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "Configuração incompleta no painel (URL ou API Key ausente)",
                details: { url_configured: !!url, api_key_configured: !!key }
              }),
              { status: 400, headers },
            );
          }

          const isTest = body.test === true;
          
          if (isTest) {
            // Se for teste, exige autenticação de admin para evitar abuso
            const authHeader = request.headers.get("Authorization");
            if (!authHeader) {
              return new Response(JSON.stringify({ success: false, error: "Autenticação necessária para testes" }), { status: 401, headers });
            }
            const token = authHeader.replace("Bearer ", "");
            const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
            if (authErr || !user || user.id !== 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3') {
              return new Response(JSON.stringify({ success: false, error: "Acesso negado" }), { status: 403, headers });
            }
          }

          const payload = body.payload || {
            event: "order.created",
            source: "sitecreatorfly-test",
            pizzeria: {
              slug: r.slug || "pizzaria-teste",
              name: (r.name || "Pizzaria Teste") + " (TESTE)"
            },
            customer: {
              name: "Admin SiteCreatorFly",
              phone: "71999999999",
              address: "Teste de Conexão",
              neighborhood: "Backend Proxy",
              reference: "OK"
            },
            order: {
              id: "test-" + Date.now(),
              created_at: new Date().toISOString(),
              items: [{ name: "Teste de Conexão", quantity: 1, unit_price: 1, total_price: 1 }],
              total: 1,
              subtotal: 1,
              delivery_fee: 0,
              payment_method: "TESTE",
              delivery_type: "retirada",
              notes: "Este é um teste de conexão vindo do painel admin."
            }
          };

          if (payload) {
            payload.api_key = key;
          }

          const idempotencyKey = request.headers.get("x-idempotency-key") || payload.order?.id || "";
          const maxRetries = isTest ? 0 : 3;
          let lastErr = "";
          let lastStatus = 0;
          let finalData: any = null;
          let isSuccess = false;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              console.log(`[SUBMIT-ORDER] Tentativa ${attempt + 1} para: ${url}`);
              const res = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": key,
                  "Authorization": `Bearer ${key}`,
                  "x-idempotency-key": idempotencyKey,
                  "User-Agent": "SiteCreatorFly-Proxy/1.0",
                },
                body: JSON.stringify(payload),
              });
              
              const txt = await res.text().catch(() => "");
              lastStatus = res.status;
              
              try { 
                finalData = JSON.parse(txt); 
              } catch { 
                finalData = { text: txt }; 
              }

              if (res.ok && finalData?.status !== "error" && finalData?.success !== false) {
                isSuccess = true;
                break;
              }
              
              lastErr = !res.ok ? `HTTP ${res.status}: ${txt.slice(0, 100)}` : (finalData?.message || finalData?.error || "Pedido rejeitado");
              console.warn(`[SUBMIT-ORDER] Tentativa ${attempt + 1} falhou: ${lastErr}`);
              
              if (res.status >= 400 && res.status < 500) break;
            } catch (e: any) {
              lastErr = `Erro de conexão: ${e.message}`;
              console.error(`[SUBMIT-ORDER] Erro na tentativa ${attempt + 1}:`, e);
            }
            if (attempt < maxRetries) await new Promise((res_wait) => setTimeout(res_wait, 1000 * Math.pow(2, attempt)));
          }

          await supabaseAdmin.from("flycontrol_order_logs").insert({
            restaurant_id: body.restaurant_id,
            idempotency_key: idempotencyKey,
            payload: payload,
            status_code: lastStatus,
            success: isSuccess,
            error_message: isSuccess ? null : lastErr,
            response_body: finalData ? JSON.stringify(finalData) : null,
          });

          return new Response(
            JSON.stringify({ 
              success: isSuccess, 
              error: isSuccess ? null : `Falha ao conectar com o FlyControl (${lastStatus}). Tente novamente ou use o WhatsApp.`,
              status: lastStatus,
              response: isSuccess ? { success: true } : null
            }), 
            {
              status: isSuccess ? 200 : (lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502),
              headers,
            }
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({ success: false, error: "Erro interno" }),
            { status: 500, headers },
          );
        }
      },
    },
  },
});