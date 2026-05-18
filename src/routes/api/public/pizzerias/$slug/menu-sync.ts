import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export const Route = createFileRoute("/api/public/pizzerias/$slug/menu-sync")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: corsHeaders }),
      GET: async ({ params, request }) => {
        const { slug } = params;
        const apiKey = request.headers.get("x-api-key") || 
                        request.headers.get("authorization")?.replace("Bearer ", "");

        if (!apiKey) {
          return new Response(JSON.stringify({ error: "API Key obrigatória" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Valida pizzaria e API Key
        const { data: restaurant, error: rErr } = await supabaseAdmin
          .from("restaurants")
          .select("id, name, slug, flycontrol_api_key")
          .eq("slug", slug)
          .single();

        if (rErr || !restaurant) {
          return new Response(JSON.stringify({ error: "Pizzaria não encontrada" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (restaurant.flycontrol_api_key !== apiKey) {
          return new Response(JSON.stringify({ error: "API Key inválida" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Busca dados do cardápio em paralelo
        const [cats, items, bevs, combos] = await Promise.all([
          supabaseAdmin.from("menu_categories").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
          supabaseAdmin.from("menu_items").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
          supabaseAdmin.from("pizzeria_beverages").select("*").eq("pizzeria_id", restaurant.id).order("sort_order"),
          supabaseAdmin.from("combos").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
        ]);

        return new Response(
          JSON.stringify({
            pizzeria: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
            categories: (cats.data || []).map(c => ({
              id: c.id,
              name: c.name,
              active: c.is_active,
              sort_order: c.sort_order,
              is_pizza: c.is_pizza,
              pizza_sizes: c.pizza_sizes
            })),
            products: (items.data || []).map(i => ({
              id: i.id,
              category_id: i.category_id,
              name: i.name,
              description: i.description,
              price: i.price,
              image_url: i.image_url,
              active: i.is_active,
              sort_order: i.sort_order,
              is_special: i.is_special,
              special_extra: i.special_extra,
              sizes: i.sizes
            })),
            beverages: (bevs.data || []).map(b => ({
              id: b.id,
              name: b.name,
              brand: b.brand,
              size: b.size,
              price: b.price,
              active: b.is_active
            })),
            combos: (combos.data || []).map(c => ({
              id: c.id,
              name: c.name,
              description: c.badge,
              price: c.price,
              active: true,
              items: c.items
            }))
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      },
    },
  },
});
*** End Patch
