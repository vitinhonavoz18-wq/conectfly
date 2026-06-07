import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  if (origin && isLovablePreview) {
    allowOrigin = origin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function joinUrl(base: string, path: string) {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

export const Route = createFileRoute("/api/public/open-table-session")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { headers: getCorsHeaders(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };
        
        try {
          const body = (await request.json()) as {
            restaurant_id?: string;
            payload?: any;
          };
          
          if (!body?.restaurant_id || !body?.payload) {
            return new Response(JSON.stringify({ success: false, error: "Dados incompletos" }), { status: 400, headers });
          }

          const { data: r, error } = await supabaseAdmin
            .from("restaurants")
            .select("id, name, slug, flycontrol_api_key, flycontrol_base_url")
            .eq("id", body.restaurant_id)
            .maybeSingle();

          if (error || !r) {
            return new Response(JSON.stringify({ success: false, error: "Pizzaria não encontrada" }), { status: 404, headers });
          }

          let base = (r.flycontrol_base_url ?? "").trim();
          if (!base) {
            return new Response(JSON.stringify({ success: false, error: "Configuração incompleta" }), { status: 400, headers });
          }
          if (!base.startsWith("http")) base = "https://" + base;

          const url = joinUrl(base, "api/public/open-table-session");
          const key = (r.flycontrol_api_key ?? "").trim();

          console.log(`[OPEN-TABLE-SESSION] Forwarding to: ${url}`);

          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": key,
              "Authorization": `Bearer ${key}`,
            },
            body: JSON.stringify({
              ...body.payload,
              api_key: key // Add key to payload as well for backward compatibility
            }),
          });
          
          const txt = await res.text();
          let finalData: any = {};
          try { finalData = JSON.parse(txt); } catch { finalData = { text: txt }; }

          return new Response(
            JSON.stringify({ 
              success: res.ok && (finalData.success !== false), 
              ...finalData 
            }), 
            { status: res.status, headers }
          );
        } catch (e: any) {
          console.error("[OPEN-TABLE-SESSION] Error:", e);
          return new Response(JSON.stringify({ success: false, error: "Erro interno" }), { status: 500, headers });
        }
      },
    },
  },
});