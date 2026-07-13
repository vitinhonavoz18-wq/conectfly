import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { slugify, subdomainify, getPizzeriaPublicUrl } from "@/lib/site/format";
import {
  DEFAULT_MENU,
  DEFAULT_DELIVERY_ZONES,
} from "@/lib/site/defaultMenu";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, x-fl-provision-secret, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSyncToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || `site-${Date.now()}`;
  for (let i = 0; i < 10; i++) {
    const { data } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now()}`;
}

async function ensureUniqueSubdomain(base: string): Promise<string> {
  let sub = base || `site${Date.now()}`;
  for (let i = 0; i < 10; i++) {
    const { data } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("custom_subdomain", sub)
      .maybeSingle();
    if (!data) return sub;
    sub = `${base}${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}${Date.now()}`;
}

async function seedMenuAdmin(restaurantId: string) {
  const { data: existing } = await supabaseAdmin
    .from("menu_categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .limit(1);
  if (existing && existing.length > 0) return;

  for (let ci = 0; ci < DEFAULT_MENU.length; ci++) {
    const cat = DEFAULT_MENU[ci];
    const { data: catRow, error: catErr } = await supabaseAdmin
      .from("menu_categories")
      .insert({
        restaurant_id: restaurantId,
        name: cat.name,
        icon: cat.icon,
        is_pizza: cat.is_pizza,
        pizza_sizes: cat.pizza_sizes as never,
        sort_order: ci,
        is_active: true,
      })
      .select()
      .single();
    if (catErr || !catRow) {
      console.error("[provision] category insert failed", cat.name, catErr);
      continue;
    }

    const isBeverageCat =
      cat.name.toLowerCase() === "bebidas" || cat.name.toLowerCase() === "bebida";

    if (cat.flavors.length > 0) {
      if (isBeverageCat) {
        const rows = cat.flavors.map((f, idx) => ({
          pizzeria_id: restaurantId,
          name: f.name,
          price: f.name.includes("Lata") ? 6 : f.name.includes("2L") ? 14 : 8,
          is_active: true,
          sort_order: idx,
        }));
        await supabaseAdmin.from("pizzeria_beverages").insert(rows);
      } else {
        const rows = cat.flavors.map((f, idx) => ({
          restaurant_id: restaurantId,
          category_id: catRow.id,
          name: f.name,
          description: f.description,
          price: 0,
          is_special: f.is_special,
          special_extra: f.special_extra,
          sort_order: idx,
          is_active: true,
        }));
        await supabaseAdmin.from("menu_items").insert(rows);
      }
    }

    if (cat.is_pizza && cat.pizza_sizes) {
      const sizeRows = cat.pizza_sizes.map((s, idx) => ({
        pizzeria_id: restaurantId,
        name: s.label,
        price: s.price,
        max_flavors: s.max_flavors,
        slices: s.slices || 0,
        is_active: true,
        sort_order: idx,
      }));
      await supabaseAdmin.from("pizzeria_pizza_sizes").insert(sizeRows);
    }
  }
}

async function seedDeliveryZonesAdmin(restaurantId: string) {
  const { data: existing } = await supabaseAdmin
    .from("delivery_zones")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .limit(1);
  if (existing && existing.length > 0) return;
  const rows = DEFAULT_DELIVERY_ZONES.map((z, i) => ({
    restaurant_id: restaurantId,
    neighborhood: z.neighborhood,
    fee: z.fee,
    sort_order: i,
  }));
  await supabaseAdmin.from("delivery_zones").insert(rows);
}

export const Route = createFileRoute("/api/internal/provision-restaurant")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: corsHeaders }),
      POST: async ({ request }) => {
        const expected = process.env.FL_PROVISION_SECRET;
        if (!expected) {
          console.error("[provision] FL_PROVISION_SECRET not configured");
          return json(
            { success: false, error: "provisioning not configured" },
            503,
          );
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
        const name = String(body?.name ?? "").trim();
        if (!flycontrol_id) {
          return json({ success: false, error: "flycontrol_id required" }, 400);
        }
        if (!name) {
          return json({ success: false, error: "name required" }, 400);
        }

        // Idempotency: return existing record for this flycontrol_id
        const { data: existing } = await supabaseAdmin
          .from("restaurants")
          .select(
            "id, flycontrol_id, slug, custom_subdomain, flycontrol_api_key, menu_sync_token",
          )
          .eq("flycontrol_id", flycontrol_id)
          .maybeSingle();

        if (existing) {
          return json({
            success: true,
            already_exists: true,
            restaurant_id: existing.id,
            flycontrol_id: existing.flycontrol_id,
            slug: existing.slug,
            custom_subdomain: existing.custom_subdomain,
            public_url: getPizzeriaPublicUrl(
              existing.slug,
              existing.custom_subdomain,
            ),
            flycontrol_api_key: existing.flycontrol_api_key,
            menu_sync_token: existing.menu_sync_token,
          });
        }

        const baseSlug = slugify(String(body?.slug ?? "") || name) || `site-${Date.now()}`;
        const baseSub = subdomainify(String(body?.slug ?? "") || name) || `site${Date.now()}`;
        const slug = await ensureUniqueSlug(baseSlug);
        const custom_subdomain = await ensureUniqueSubdomain(baseSub);

        const flycontrol_api_key =
          (typeof body?.api_key === "string" && body.api_key.trim()) ||
          generateApiKey();
        const menu_sync_token = generateSyncToken();

        const business_type =
          typeof body?.business_type === "string" && body.business_type.trim()
            ? body.business_type.trim()
            : "pizzeria";
        const selected_template =
          typeof body?.selected_template === "string" &&
          body.selected_template.trim()
            ? body.selected_template.trim()
            : "black";

        const insertPayload: Record<string, unknown> = {
          name,
          slug,
          custom_subdomain,
          flycontrol_id,
          flycontrol_api_key,
          menu_sync_token,
          business_type,
          selected_template,
          published: true,
          owner_id: null,
        };
        // owner_name is accepted in the payload for logging/traceability
        // but is not persisted (no such column on restaurants).

        const { data: created, error: insErr } = await supabaseAdmin
          .from("restaurants")
          .insert(insertPayload as any)
          .select(
            "id, flycontrol_id, slug, custom_subdomain, flycontrol_api_key, menu_sync_token",
          )
          .single();

        if (insErr || !created) {
          console.error("[provision] insert failed", insErr);
          return json(
            { success: false, error: insErr?.message ?? "insert_failed" },
            500,
          );
        }

        try {
          await seedMenuAdmin(created.id);
          await seedDeliveryZonesAdmin(created.id);
        } catch (e) {
          console.warn("[provision] seed error", e);
        }

        return json({
          success: true,
          restaurant_id: created.id,
          flycontrol_id: created.flycontrol_id,
          slug: created.slug,
          custom_subdomain: created.custom_subdomain,
          public_url: getPizzeriaPublicUrl(
            created.slug,
            created.custom_subdomain,
          ),
          flycontrol_api_key: created.flycontrol_api_key,
          menu_sync_token: created.menu_sync_token,
        });
      },
    },
  },
});
