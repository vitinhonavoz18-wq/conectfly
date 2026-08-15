import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateApiKey } from "@/lib/api-auth";
import { buildCorsHeaders } from "@/lib/cors";

const CORS_OPTS = {
  methods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  headers: "content-type, x-api-key, apikey, authorization",
};
const getCorsHeaders = (request: Request) => buildCorsHeaders(request, CORS_OPTS);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: any) => typeof v === "string" && UUID_RE.test(v);

type ResourceCfg = { table: string; ownerField: "restaurant_id" | "pizzeria_id" };

const RESOURCES: Record<string, ResourceCfg> = {
  product: { table: "menu_items", ownerField: "restaurant_id" },
  border: { table: "menu_items", ownerField: "restaurant_id" },
  additional: { table: "menu_items", ownerField: "restaurant_id" },
  category: { table: "menu_categories", ownerField: "restaurant_id" },
  beverage: { table: "pizzeria_beverages", ownerField: "pizzeria_id" },
  combo: { table: "combos", ownerField: "restaurant_id" },
  "delivery-zone": { table: "delivery_zones", ownerField: "restaurant_id" },
  "pizza-size": { table: "pizzeria_pizza_sizes", ownerField: "pizzeria_id" },
};

const RESTAURANT_WRITABLE = new Set([
  "name",
  "tagline",
  "description",
  "whatsapp_number",
  "whatsapp_display",
  "address",
  "hours",
  "city",
  "logo_url",
  "hero_image_url",
  "primary_color",
  "secondary_color",
  "published",
  "hero_media_type",
  "hero_video_url",
  "whatsapp_enabled",
  "show_item_images",
  "selected_template",
  "business_type",
  "theme_settings",
  "site_settings",
  "checkout_settings",
  "delivery_settings",
  "seo_settings",
  "order_flow_mode",
  "continue_opening_whatsapp",
  "allow_dual_send",
  "delivery_enabled",
  "pickup_enabled",
  "table_enabled",
]);

// Colunas JSONB de configuração — um UPDATE comum SUBSTITUI a coluna
// inteira, não mescla. Um chamador que só conhece uma parte das chaves
// (ex.: o FlyControl mandando apenas `entry_mode` dentro de `site_settings`)
// apagaria silenciosamente qualquer outra chave já salva ali por outro
// caminho (o próprio editor do SiteCreatorFly, por exemplo). Por isso estas
// colunas são sempre mescladas com o valor atual antes de gravar.
const JSONB_SETTINGS_FIELDS = [
  "theme_settings",
  "site_settings",
  "checkout_settings",
  "delivery_settings",
  "seo_settings",
] as const;

async function mergeJsonbSettings(restaurantId: string, patch: Record<string, any>) {
  const keysToMerge = JSONB_SETTINGS_FIELDS.filter((k) => k in patch);
  if (keysToMerge.length === 0) return patch;

  const { data: current } = await supabaseAdmin
    .from("restaurants")
    .select(keysToMerge.join(","))
    .eq("id", restaurantId)
    .maybeSingle();

  const merged = { ...patch };
  for (const key of keysToMerge) {
    const existing = (current as Record<string, any> | null)?.[key];
    merged[key] = { ...(existing && typeof existing === "object" ? existing : {}), ...patch[key] };
  }
  return merged;
}

/**
 * Bordas e adicionais moram na mesma tabela dos itens do cardápio
 * (`menu_items`), e essa tabela exige uma categoria — não existe item solto.
 *
 * O FlyControl não conhece essa regra: lá "Bordas & Adicionais" é uma tela
 * própria, sem categoria nenhuma. Sem tradução no meio do caminho, o item
 * chegava aqui sem categoria e o banco recusava — como tentar guardar um
 * prato no cardápio sem dizer em qual página ele entra.
 *
 * Então a categoria é criada aqui, uma única vez por restaurante. Os nomes
 * aceitos são os mesmos que os modelos de site já reconhecem (ver `isBordas`
 * nos templates), para não criar uma categoria duplicada quando o dono já
 * tem uma "Bordas" feita à mão no editor.
 */
const EXTRA_CATEGORY: Record<string, { create: string; icon: string; accept: string[] }> = {
  border: {
    create: "BORDAS RECHEADAS",
    icon: "🥖",
    accept: ["BORDAS RECHEADAS", "BORDA RECHEADA", "BORDAS", "BORDA"],
  },
  additional: {
    create: "ADICIONAIS",
    icon: "➕",
    accept: ["ADICIONAIS", "ADICIONAL", "COMPLEMENTOS", "COMPLEMENTO"],
  },
};

async function ensureExtraCategory(type: string, restaurantId: string): Promise<string | null> {
  const spec = EXTRA_CATEGORY[type];
  if (!spec) return null;

  const { data: existing } = await supabaseAdmin
    .from("menu_categories")
    .select("id, name")
    .eq("restaurant_id", restaurantId);

  const rows = (existing ?? []) as Array<{ id: string; name: string | null }>;
  const found = rows.find((c) => spec.accept.includes((c.name ?? "").trim().toUpperCase()));
  if (found) return found.id;

  const { data: created, error } = await supabaseAdmin
    .from("menu_categories")
    .insert({
      restaurant_id: restaurantId,
      name: spec.create,
      icon: spec.icon,
      is_pizza: false,
      sort_order: (existing?.length ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) throw error;
  return created?.id ?? null;
}

async function resolveCategoryId(raw: any, restaurantId: string) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (isUuid(raw)) return raw;
  const { data } = await supabaseAdmin
    .from("menu_categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("external_id", String(raw))
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveRecordId(identifier: string, cfg: ResourceCfg, restaurantId: string) {
  if (isUuid(identifier)) return identifier;
  const { data } = await (supabaseAdmin.from(cfg.table as any) as any)
    .select("id")
    .eq(cfg.ownerField, restaurantId)
    .eq("external_id", identifier)
    .maybeSingle();
  return data?.id ?? null;
}

const mapFields = (body: any, type: string) => {
  const data = { ...body };
  if ("active" in data) {
    data.is_active = data.active;
    delete data.active;
  }
  if ("highlight" in data) {
    data.is_highlighted = data.highlight;
    delete data.highlight;
  }
  if (type === "combo" && "description" in data) {
    data.badge = data.description;
    delete data.description;
  }
  // `extra_type` só existe no FlyControl, para separar borda de adicional na
  // tela dele. Aqui essa separação já virou a categoria de destino, e a
  // coluna não existe nesta tabela — deixá-la passar derruba a gravação.
  delete data.extra_type;
  delete data.id;
  delete data.restaurant_id;
  delete data.pizzeria_id;
  return data;
};

const json = (body: any, status: number, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/menu-sync/$")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { headers: getCorsHeaders(request) }),

      POST: async ({ request, params }: { request: Request; params: any }) => {
        const corsHeaders = getCorsHeaders(request);
        const auth = await validateApiKey(request);
        if (auth.error || !auth.restaurant) {
          return json(
            { success: false, error: auth.error || "Unauthorized" },
            auth.status || 401,
            corsHeaders,
          );
        }
        const restaurant = auth.restaurant;
        const splat = (params._splat || "").split("/").filter(Boolean);
        const type = splat[0] || "";
        const body = await request.json();

        console.log(`[menu-sync] POST ${type} for ${restaurant.slug}`);

        try {
          if (type === "restaurant") {
            return json(
              { success: false, error: "restaurant does not support POST; use PATCH" },
              405,
              corsHeaders,
            );
          }
          const cfg = RESOURCES[type];
          if (!cfg) return json({ success: false, error: "Invalid path" }, 400, corsHeaders);

          const mappedData = mapFields(body, type);

          if (cfg.table === "menu_items" && "category_id" in mappedData) {
            const resolved = await resolveCategoryId(mappedData.category_id, restaurant.id!);
            if (mappedData.category_id && !resolved) {
              return json(
                { success: false, error: `category_id not found: ${mappedData.category_id}` },
                400,
                corsHeaders,
              );
            }
            mappedData.category_id = resolved;
          }

          // Borda e adicional chegam sem categoria: ela é decidida aqui, e
          // não por quem chamou. Vale também quando veio um `category_id`
          // vazio, que a checagem acima transforma em nulo.
          if (cfg.table === "menu_items" && !mappedData.category_id && EXTRA_CATEGORY[type]) {
            mappedData.category_id = await ensureExtraCategory(type, restaurant.id!);
          }

          const dataWithOwnership: any = { ...mappedData, [cfg.ownerField]: restaurant.id };

          const { data: result, error } = await (supabaseAdmin.from(cfg.table as any) as any)
            .insert(dataWithOwnership)
            .select()
            .single();

          if (error) throw error;
          return json({ success: true, data: result }, 201, corsHeaders);
        } catch (err: any) {
          console.error(`[menu-sync] POST ${type} error:`, err);
          return json({ success: false, error: err.message }, 500, corsHeaders);
        }
      },

      PUT: async ({ request, params }: { request: Request; params: any }) => {
        const corsHeaders = getCorsHeaders(request);
        const auth = await validateApiKey(request);
        if (auth.error || !auth.restaurant) {
          return json(
            { success: false, error: auth.error || "Unauthorized" },
            auth.status || 401,
            corsHeaders,
          );
        }
        const restaurant = auth.restaurant;
        const splat = (params._splat || "").split("/").filter(Boolean);
        const type = splat[0];
        const rawId = splat[1];
        const body = await request.json();

        console.log(`[menu-sync] PUT ${type}/${rawId ?? "(self)"} for ${restaurant.slug}`);

        try {
          if (type === "restaurant") {
            let patch: any = {};
            for (const [k, v] of Object.entries(body)) {
              if (RESTAURANT_WRITABLE.has(k)) patch[k] = v;
            }
            if (Object.keys(patch).length === 0) {
              return json(
                { success: false, error: "No writable fields provided" },
                400,
                corsHeaders,
              );
            }
            patch = await mergeJsonbSettings(restaurant.id!, patch);
            const { data: result, error } = await supabaseAdmin
              .from("restaurants")
              .update(patch)
              .eq("id", restaurant.id!)
              .select()
              .maybeSingle();
            if (error) throw error;
            return json({ success: true, data: result }, 200, corsHeaders);
          }

          const cfg = RESOURCES[type];
          if (!cfg) return json({ success: false, error: "Invalid type" }, 400, corsHeaders);
          if (!rawId) return json({ success: false, error: "ID is required" }, 400, corsHeaders);

          const internalId = await resolveRecordId(rawId, cfg, restaurant.id!);
          if (!internalId)
            return json(
              { success: false, error: "Record not found or unauthorized" },
              404,
              corsHeaders,
            );

          const mappedData = mapFields(body, type);
          if (cfg.table === "menu_items" && "category_id" in mappedData) {
            const resolved = await resolveCategoryId(mappedData.category_id, restaurant.id!);
            if (mappedData.category_id && !resolved) {
              return json(
                { success: false, error: `category_id not found: ${mappedData.category_id}` },
                400,
                corsHeaders,
              );
            }
            mappedData.category_id = resolved;
            // Numa edição, apagar a categoria deixaria o item órfão e o banco
            // recusaria a gravação inteira. Se sumiu, recai na categoria
            // padrão do tipo em vez de derrubar a edição.
            if (!mappedData.category_id && EXTRA_CATEGORY[type]) {
              mappedData.category_id = await ensureExtraCategory(type, restaurant.id!);
            }
            if (!mappedData.category_id) delete mappedData.category_id;
          }

          const { data: result, error } = await (supabaseAdmin.from(cfg.table as any) as any)
            .update(mappedData)
            .eq("id", internalId)
            .eq(cfg.ownerField, restaurant.id)
            .select()
            .maybeSingle();

          if (error) throw error;
          if (!result)
            return json(
              { success: false, error: "Record not found or unauthorized" },
              404,
              corsHeaders,
            );
          return json({ success: true, data: result }, 200, corsHeaders);
        } catch (err: any) {
          console.error(`[menu-sync] PUT ${type}/${rawId} error:`, err);
          return json({ success: false, error: err.message }, 500, corsHeaders);
        }
      },

      PATCH: async ({ request, params }: { request: Request; params: any }) => {
        const corsHeaders = getCorsHeaders(request);
        const auth = await validateApiKey(request);
        if (auth.error || !auth.restaurant) {
          return json(
            { success: false, error: auth.error || "Unauthorized" },
            auth.status || 401,
            corsHeaders,
          );
        }
        const restaurant = auth.restaurant;
        const splat = (params._splat || "").split("/").filter(Boolean);
        const type = splat[0];
        const rawId = splat[1];
        const action = splat[2];
        const body = await request.json();

        console.log(
          `[menu-sync] PATCH ${type}/${rawId ?? "(self)"}/${action || ""} for ${restaurant.slug}`,
        );

        try {
          if (type === "restaurant") {
            let patch: any = {};
            if (action === "status" || rawId === "status") {
              const val = body.active ?? body.is_active ?? body.published;
              patch = { published: !!val };
            } else {
              for (const [k, v] of Object.entries(body)) {
                if (RESTAURANT_WRITABLE.has(k)) patch[k] = v;
              }
            }
            if (Object.keys(patch).length === 0) {
              return json(
                { success: false, error: "No writable fields provided" },
                400,
                corsHeaders,
              );
            }
            patch = await mergeJsonbSettings(restaurant.id!, patch);
            const { data: result, error } = await supabaseAdmin
              .from("restaurants")
              .update(patch)
              .eq("id", restaurant.id!)
              .select()
              .maybeSingle();
            if (error) throw error;
            return json({ success: true, data: result }, 200, corsHeaders);
          }

          const cfg = RESOURCES[type];
          if (!cfg) return json({ success: false, error: "Invalid type" }, 400, corsHeaders);
          if (!rawId) return json({ success: false, error: "ID is required" }, 400, corsHeaders);

          const internalId = await resolveRecordId(rawId, cfg, restaurant.id!);
          if (!internalId)
            return json(
              { success: false, error: "Record not found or unauthorized" },
              404,
              corsHeaders,
            );

          let updateData = mapFields(body, type);
          if (action === "status") {
            updateData = { is_active: body.active ?? body.is_active };
          } else if (cfg.table === "menu_items" && "category_id" in updateData) {
            const resolved = await resolveCategoryId(updateData.category_id, restaurant.id!);
            if (updateData.category_id && !resolved) {
              return json(
                { success: false, error: `category_id not found: ${updateData.category_id}` },
                400,
                corsHeaders,
              );
            }
            updateData.category_id = resolved;
          }

          const { data: result, error } = await (supabaseAdmin.from(cfg.table as any) as any)
            .update(updateData)
            .eq("id", internalId)
            .eq(cfg.ownerField, restaurant.id)
            .select()
            .maybeSingle();

          if (error) throw error;
          if (!result)
            return json(
              { success: false, error: "Record not found or unauthorized" },
              404,
              corsHeaders,
            );
          return json({ success: true, data: result }, 200, corsHeaders);
        } catch (err: any) {
          console.error(`[menu-sync] PATCH ${type}/${rawId} error:`, err);
          return json({ success: false, error: err.message }, 500, corsHeaders);
        }
      },

      DELETE: async ({ request, params }: { request: Request; params: any }) => {
        const corsHeaders = getCorsHeaders(request);
        const auth = await validateApiKey(request);
        if (auth.error || !auth.restaurant) {
          return json(
            { success: false, error: auth.error || "Unauthorized" },
            auth.status || 401,
            corsHeaders,
          );
        }
        const restaurant = auth.restaurant;
        const splat = (params._splat || "").split("/").filter(Boolean);
        const type = splat[0];
        const rawId = splat[1];

        console.log(`[menu-sync] DELETE ${type}/${rawId} for ${restaurant.slug}`);

        try {
          if (type === "restaurant") {
            return json(
              { success: false, error: "restaurant does not support DELETE" },
              405,
              corsHeaders,
            );
          }
          const cfg = RESOURCES[type];
          if (!cfg) return json({ success: false, error: "Invalid type" }, 400, corsHeaders);
          if (!rawId) return json({ success: false, error: "ID is required" }, 400, corsHeaders);

          const internalId = await resolveRecordId(rawId, cfg, restaurant.id!);
          if (!internalId)
            return json(
              { success: false, error: "Record not found or unauthorized" },
              404,
              corsHeaders,
            );

          const { error } = await (supabaseAdmin.from(cfg.table as any) as any)
            .delete()
            .eq("id", internalId)
            .eq(cfg.ownerField, restaurant.id);

          if (error) throw error;
          return json({ success: true, id: internalId }, 200, corsHeaders);
        } catch (err: any) {
          console.error(`[menu-sync] DELETE ${type}/${rawId} error:`, err);
          return json({ success: false, error: err.message }, 500, corsHeaders);
        }
      },
    },
  },
});
