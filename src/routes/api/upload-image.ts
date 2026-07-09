import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateApiKey } from "@/lib/api-auth";
import { buildCorsHeaders, preflightResponse } from "@/lib/cors";

const CORS_OPTS = {
  methods: "POST, OPTIONS",
  headers: "content-type, x-api-key, apikey, authorization",
};

const BUCKET = "logos";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// type -> { folder, table?, column?, ownerField? }
// When table/column are provided, the endpoint updates the DB row and
// deletes the previous storage object (best-effort) to avoid orphans.
const TYPE_MAP: Record<
  string,
  { folder: string; table?: string; column?: string; ownerField?: "restaurant_id" | "pizzeria_id"; ownerValueField?: "id" }
> = {
  product:      { folder: "products",    table: "menu_items",           column: "image_url", ownerField: "restaurant_id" },
  category:     { folder: "categories",  table: "menu_categories",      column: "image_url", ownerField: "restaurant_id" },
  beverage:     { folder: "beverages",   table: "pizzeria_beverages",   column: "image_url", ownerField: "pizzeria_id" },
  combo:        { folder: "combos",      table: "combos",               column: "image_url", ownerField: "restaurant_id" },
  extra:        { folder: "extras",      table: "menu_items",           column: "image_url", ownerField: "restaurant_id" },
  border:       { folder: "borders",     table: "menu_items",           column: "image_url", ownerField: "restaurant_id" },
  "pizza-size": { folder: "pizza-sizes", table: "pizzeria_pizza_sizes", column: "image_url", ownerField: "pizzeria_id" },
  logo:         { folder: "logo",        table: "restaurants",          column: "logo_url",       ownerValueField: "id" },
  hero:         { folder: "hero",        table: "restaurants",          column: "hero_image_url", ownerValueField: "id" },
  banner:       { folder: "banners" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: any) => typeof v === "string" && UUID_RE.test(v);

function json(body: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function resolveResourceId(
  identifier: string,
  table: string,
  ownerField: "restaurant_id" | "pizzeria_id",
  restaurantId: string,
): Promise<string | null> {
  if (isUuid(identifier)) return identifier;
  const { data } = await (supabaseAdmin.from(table as any) as any)
    .select("id")
    .eq(ownerField, restaurantId)
    .eq("external_id", identifier)
    .maybeSingle();
  return data?.id ?? null;
}

// Extract the storage path inside BUCKET from a previously-issued public URL.
function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export const Route = createFileRoute("/api/upload-image")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflightResponse(request, CORS_OPTS),

      POST: async ({ request }) => {
        const cors = buildCorsHeaders(request, CORS_OPTS);

        // 1. Auth via API key -> restaurant
        const auth = await validateApiKey(request);
        if ("error" in auth) return json({ success: false, error: auth.error }, auth.status, cors);
        const restaurant = auth.restaurant;

        // 2. Parse multipart
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ success: false, error: "Invalid multipart/form-data body" }, 400, cors);
        }

        const file = form.get("file");
        const type = String(form.get("type") ?? "").trim();
        const resourceIdRaw = form.get("resourceId");
        const resourceId = resourceIdRaw != null ? String(resourceIdRaw).trim() : "";

        if (!(file instanceof File)) {
          return json({ success: false, error: "Field 'file' is required (multipart file)" }, 400, cors);
        }
        if (!type || !(type in TYPE_MAP)) {
          return json(
            { success: false, error: `Field 'type' must be one of: ${Object.keys(TYPE_MAP).join(", ")}` },
            400,
            cors,
          );
        }

        // 3. Validate file
        const mime = (file.type || "").toLowerCase();
        if (!ALLOWED_MIME.has(mime)) {
          return json({ success: false, error: "Unsupported MIME type. Allowed: jpg, jpeg, png, webp" }, 415, cors);
        }
        if (file.size > MAX_BYTES) {
          return json({ success: false, error: "File too large. Max 10MB" }, 413, cors);
        }

        const cfg = TYPE_MAP[type];
        const ext = EXT_BY_MIME[mime] ?? "jpg";

        // 4. Resolve target DB row (when applicable) + previous image for cleanup
        let dbRowId: string | null = null;
        let previousUrl: string | null = null;

        if (cfg.table && cfg.column) {
          if (cfg.ownerValueField === "id") {
            // restaurant-scoped single row (logo/hero) — always the authenticated restaurant
            dbRowId = restaurant.id;
          } else if (cfg.ownerField) {
            if (!resourceId) {
              return json({ success: false, error: "Field 'resourceId' is required for this type" }, 400, cors);
            }
            dbRowId = await resolveResourceId(resourceId, cfg.table, cfg.ownerField, restaurant.id);
            if (!dbRowId) {
              return json({ success: false, error: `Resource '${resourceId}' not found for this restaurant` }, 404, cors);
            }
          }

          if (dbRowId) {
            const { data: row } = await (supabaseAdmin.from(cfg.table as any) as any)
              .select(cfg.column)
              .eq("id", dbRowId)
              .maybeSingle();
            previousUrl = (row as any)?.[cfg.column] ?? null;
          }
        }

        // 5. Upload to Supabase Storage under restaurants/{id}/{folder}/
        const filename = `${crypto.randomUUID()}.${ext}`;
        const path = `restaurants/${restaurant.id}/${cfg.folder}/${filename}`;

        const buf = new Uint8Array(await file.arrayBuffer());
        const { error: upErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, buf, { contentType: mime, upsert: true });
        if (upErr) {
          return json({ success: false, error: `Upload failed: ${upErr.message}` }, 500, cors);
        }

        const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
        const publicUrl = pub.publicUrl;

        // 6. Update DB row (when applicable)
        if (cfg.table && cfg.column && dbRowId) {
          await (supabaseAdmin.from(cfg.table as any) as any)
            .update({ [cfg.column]: publicUrl })
            .eq("id", dbRowId);
        }

        // 7. Delete previous storage object (best-effort) to avoid orphans
        const previousPath = extractStoragePath(previousUrl);
        if (previousPath && previousPath !== path) {
          await supabaseAdmin.storage.from(BUCKET).remove([previousPath]).catch(() => {});
        }

        return json({ success: true, url: publicUrl, path }, 200, cors);
      },
    },
  },
});