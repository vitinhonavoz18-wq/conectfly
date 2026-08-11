import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-fl-provision-secret, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Chamado pelo FlyControl quando um administrador descadastra, reativa ou
// exclui definitivamente uma loja — para que o cardápio público reflita
// isso na hora, e não continue no ar como se nada tivesse acontecido.
export const Route = createFileRoute("/api/internal/deprovision-restaurant")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: corsHeaders }),
      POST: async ({ request }) => {
        const expected = process.env.FL_PROVISION_SECRET;
        if (!expected) {
          console.error("[deprovision] FL_PROVISION_SECRET not configured");
          return json({ success: false, error: "provisioning not configured" }, 503);
        }

        const provided =
          request.headers.get("x-fl-provision-secret") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!provided || provided !== expected) {
          return json({ success: false, error: "unauthorized" }, 401);
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return json({ success: false, error: "invalid_json" }, 400);
        }

        const flycontrol_id = String(body?.flycontrol_id ?? "").trim();
        const action = String(body?.action ?? "").trim();
        if (!flycontrol_id) {
          return json({ success: false, error: "flycontrol_id required" }, 400);
        }
        if (!["deactivate", "reactivate", "delete"].includes(action)) {
          return json(
            { success: false, error: "action must be deactivate, reactivate or delete" },
            400,
          );
        }

        const { data: existing, error: findErr } = await supabaseAdmin
          .from("restaurants")
          .select("id, flycontrol_id, published")
          .eq("flycontrol_id", flycontrol_id)
          .maybeSingle();

        if (findErr) {
          console.error("[deprovision] lookup error", findErr);
          return json({ success: false, error: findErr.message }, 500);
        }

        // Idempotente: se este FlyControl_id nunca chegou a ser provisionado
        // aqui, não há o que desligar — não é uma falha.
        if (!existing) {
          console.log("[deprovision] nothing to do, not provisioned:", flycontrol_id);
          return json({ success: true, already_absent: true });
        }

        const patch: any = action === "reactivate" ? { published: true } : { published: false };

        if (action === "delete") {
          // Invalida a chave para que sincronizações antigas do FlyControl
          // parem de funcionar — é como trocar a fechadura, não só desligar
          // a luz da vitrine.
          patch.flycontrol_enabled = false;
          patch.flycontrol_api_key = null;
        }

        const { error: updErr } = await supabaseAdmin
          .from("restaurants")
          .update(patch)
          .eq("id", existing.id);

        if (updErr) {
          console.error("[deprovision] update error", updErr);
          return json({ success: false, error: updErr.message }, 500);
        }

        console.log("[deprovision]", action, "restaurant_id:", existing.id);
        return json({ success: true, restaurant_id: existing.id, action });
      },
    },
  },
});
