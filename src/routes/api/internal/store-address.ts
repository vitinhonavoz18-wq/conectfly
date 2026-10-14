import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  checkStoreAddress,
  setStoreAddress,
  type AddressDb,
  type StoreRow,
} from "@/lib/site/storeAddress.server";
import { getPizzeriaPublicUrl } from "@/lib/site/format";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-fl-provision-secret, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Endereço da loja escolhido pelo dono no FlyControl ("Minha Loja").
 *
 * Só o FlyControl chama, com a mesma senha de servidor do cadastro automático
 * (FL_PROVISION_SECRET). Quem confere se o usuário logado é dono da loja é o
 * FlyControl, ANTES de chamar; aqui a loja é achada pelo vínculo com o
 * FlyControl (flycontrol_id), ou pela chave de API das lojas ligadas antes de
 * existir esse vínculo.
 *
 * Corpo: { flycontrol_id, api_key?, action: "check" | "set", address }
 */
export const Route = createFileRoute("/api/internal/store-address")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: corsHeaders }),
      POST: async ({ request }) => {
        const expected = process.env.FL_PROVISION_SECRET;
        if (!expected) {
          console.error("[store-address] FL_PROVISION_SECRET not configured");
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
        const api_key = String(body?.api_key ?? "").trim();
        const action = String(body?.action ?? "").trim();
        const address = String(body?.address ?? "");
        if (!flycontrol_id && !api_key) {
          return json({ success: false, error: "flycontrol_id required" }, 400);
        }
        if (action !== "check" && action !== "set") {
          return json({ success: false, error: "action must be check or set" }, 400);
        }

        const campos = "id, slug, custom_subdomain, city";
        let store: StoreRow | null = null;
        if (flycontrol_id) {
          const { data } = await supabaseAdmin
            .from("restaurants")
            .select(campos)
            .eq("flycontrol_id", flycontrol_id)
            .maybeSingle();
          store = (data as StoreRow | null) ?? null;
        }
        if (!store && api_key) {
          const { data } = await supabaseAdmin
            .from("restaurants")
            .select(campos)
            .eq("flycontrol_api_key", api_key)
            .maybeSingle();
          store = (data as StoreRow | null) ?? null;
        }
        if (!store) {
          return json({ success: false, error: "store_not_found" }, 404);
        }

        const db = supabaseAdmin as unknown as AddressDb;
        try {
          if (action === "check") {
            const r = await checkStoreAddress(db, store, address);
            return json({
              success: true,
              address: r.address,
              status: r.status,
              suggestions: r.suggestions,
              current_address: store.custom_subdomain,
              public_url: getPizzeriaPublicUrl(store.slug, store.custom_subdomain),
            });
          }

          const r = await setStoreAddress(db, store, address);
          if (!r.ok) {
            const status = r.status === "taken" ? 409 : 422;
            return json(
              {
                success: false,
                error: r.status,
                status: r.status,
                address: r.address,
                suggestions: r.suggestions,
              },
              status,
            );
          }
          console.log(
            "[store-address] set",
            "restaurant_id:",
            store.id,
            "from:",
            r.previous,
            "to:",
            r.address,
          );
          return json({
            success: true,
            status: "saved",
            address: r.address,
            previous_address: r.previous,
            changed: r.changed,
            public_url: r.public_url,
          });
        } catch (err) {
          // Tabela do caderno ainda não criada (migração não aplicada) cai
          // aqui: melhor dizer "indisponível" do que fingir que está livre.
          console.error("[store-address] error", err);
          return json({ success: false, error: "address_service_unavailable" }, 503);
        }
      },
    },
  },
});
