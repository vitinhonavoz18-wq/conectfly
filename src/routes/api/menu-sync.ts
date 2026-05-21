import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateApiKey } from "@/lib/api-auth";

const getCorsHeaders = (request: Request) => {
  const origin = request.headers.get("Origin");
  
  // Allow all lovable.app subdomains and standard FlyControl domains
  const isAllowed = origin && (
    origin.includes("flycontrol") || 
    origin.includes("conectfly.com.br") ||
    origin.endsWith(".lovable.app") ||
    origin.includes("localhost")
  );
  
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "*",
    "Access-Control-Allow-Headers": "content-type, x-api-key, apikey, authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
};

export const Route = createFileRoute("/api/menu-sync")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { headers: getCorsHeaders(request) }),
      GET: async ({ request }) => {
        const corsHeaders = getCorsHeaders(request);
        const origin = request.headers.get("Origin");
        
        const auth = await validateApiKey(request);
        if (auth.error || !auth.restaurant) {
          console.warn(`[menu-sync] 🚫 GET Unauthorized. Origin: \${origin}, Error: \${auth.error}`);
          return new Response(JSON.stringify({ 
            success: false, 
            error: auth.error || "Unauthorized",
            details: "API Key válida é necessária para sincronização"
          }), {
            status: auth.status || 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          const url = new URL(request.url);
          const slug = url.searchParams.get("slug");

          console.log(`[menu-sync] 🔍 Requisição recebida. Origin: \${origin}, Slug: "\${slug}"`);
          
          const restaurant = auth.restaurant;

          // Verify slug matching if provided
          if (slug && restaurant.slug !== slug) {
            console.warn(`[menu-sync] ⚠️ Slug mismatch. URL: \${slug}, Key: \${restaurant.slug}`);
            return new Response(JSON.stringify({ 
              success: false, 
              error: "API Key não pertence a esta pizzaria",
              slug 
            }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const currentSlug = slug || restaurant.slug;
          console.log(`[menu-sync] ✅ Pizzaria encontrada: \${restaurant.name} (\${restaurant.id})`);

          const [catsRes, itemsRes, groupsRes, combosRes, zonesRes, beveragesRes] = await Promise.all([
            supabaseAdmin.from("menu_categories").select("*").eq("restaurant_id", restaurant.id!).order("sort_order"),
            supabaseAdmin.from("menu_items").select("*").eq("restaurant_id", restaurant.id!).order("sort_order"),
            supabaseAdmin.from("combo_groups").select("*").eq("restaurant_id", restaurant.id!).order("sort_order"),
            supabaseAdmin.from("combos").select("*").eq("restaurant_id", restaurant.id!).order("sort_order"),
            supabaseAdmin.from("delivery_zones").select("*").eq("restaurant_id", restaurant.id!).order("sort_order"),
            supabaseAdmin.from("pizzeria_beverages").select("*").eq("pizzeria_id", restaurant.id!).order("sort_order"),
          ]);

          const categories = catsRes.data || [];
          const products = itemsRes.data || [];
          const combos = combosRes.data || [];
          const beverages = beveragesRes.data || [];
          const deliveryZones = zonesRes.data || [];

          console.log(`[menu-sync] 📦 Dados carregados: \${categories.length} cat, \${products.length} prod, \${beverages.length} bev, \${combos.length} comb, \${deliveryZones.length} zones`);

          const isBorda = (c: any) => {
            const name = c.name.toLowerCase();
            return name.includes("borda");
          };
          
          const isAdicional = (c: any) => {
            const name = c.name.toLowerCase();
            return name.includes("adicional") || name.includes("extra");
          };

          const borders = products.filter(p => {
            const cat = categories.find(c => c.id === p.category_id);
            return cat && isBorda(cat);
          });

          const additionals = products.filter(p => {
            const cat = categories.find(c => c.id === p.category_id);
            return cat && isAdicional(cat);
          });

          const response = {
            success: true,
            pizzeria: {
              id: restaurant.id,
              name: restaurant.name,
              slug: restaurant.slug
            },
            categories: categories.map(c => ({
              id: c.id,
              name: c.name,
              active: c.is_active ?? true,
              sort_order: c.sort_order,
              is_pizza: c.is_pizza,
              pizza_sizes: c.pizza_sizes,
              updated_at: (c as any).updated_at
            })),
            products: products.map(i => ({
              id: i.id,
              category_id: i.category_id,
              name: i.name,
              description: i.description,
              price: i.price,
              image_url: i.image_url,
              active: i.is_active ?? true,
              sort_order: i.sort_order,
              is_special: i.is_special,
              special_extra: i.special_extra,
              sizes: i.sizes,
              updated_at: (i as any).updated_at
            })),
            beverages: beverages.map(b => ({
              id: b.id,
              name: b.name,
              brand: b.brand,
              size: b.size,
              price: b.price,
              active: b.is_active ?? true,
              updated_at: b.updated_at
            })),
            borders: borders.map(b => ({
              id: b.id,
              pizzeria_id: restaurant.id,
              name: b.name,
              price: b.price,
              active: b.is_active ?? true,
              updated_at: (b as any).updated_at
            })),
            additionals: additionals.map(a => ({
              id: a.id,
              pizzeria_id: restaurant.id,
              name: a.name,
              price: a.price,
              active: a.is_active ?? true,
              updated_at: (a as any).updated_at
            })),
            combos: combos.map(c => ({
              id: c.id,
              name: c.name,
              description: c.badge,
              price: c.price,
              active: c.is_active ?? true,
              items: c.items,
              updated_at: (c as any).updated_at
            })),
            delivery_zones: deliveryZones.map(z => ({
              id: z.id,
              neighborhood: z.neighborhood,
              fee: z.fee,
              sort_order: z.sort_order,
              updated_at: (z as any).updated_at
            }))
          };

          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error(`[menu-sync] 💥 Erro crítico no endpoint:`, error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Erro interno no servidor",
            details: error?.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
