import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export const Route = createFileRoute("/api/public/menu-sync/$slug/$token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: corsHeaders }),
      GET: async ({ params }) => {
        const { slug, token } = params;

        console.log(`MENU_SYNC_DEBUG (Route): slug_received=${slug} token_received_preview=${token?.substring(0, 8)}...`);

        if (!slug || !token) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "missing_parameters", 
            message: "Slug e token são obrigatórios." 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Search for restaurant and validate token
        const { data: restaurant, error: rErr } = await supabaseAdmin
          .from("restaurants")
          .select("id, name, slug, menu_sync_token")
          .eq("slug", slug)
          .maybeSingle();

        console.log(`MENU_SYNC_DEBUG (Route): restaurant_found=${!!restaurant} restaurant_id=${restaurant?.id} error=${rErr?.message}`);

        if (rErr || !restaurant) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "restaurant_not_found", 
            message: "Restaurante não encontrado." 
          }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const storedToken = restaurant.menu_sync_token;
        const tokenMatch = storedToken === token;

        console.log(`MENU_SYNC_DEBUG (Route): stored_token_exists=${!!storedToken} stored_token_preview=${storedToken?.substring(0, 8)}... token_match=${tokenMatch}`);

        if (!tokenMatch) {
          console.log(`MENU_SYNC_DEBUG (Route): final_result=invalid_sync_token`);
          return new Response(JSON.stringify({ 
            success: false, 
            error: "invalid_sync_token", 
            message: "Token de sincronização inválido.",
            debug: {
              slug_received: slug,
              token_received_preview: token?.substring(0, 8) + "..."
            }
          }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`MENU_SYNC_DEBUG (Route): final_result=success`);

        // Fetch menu data
        const [catsRes, itemsRes, bevsRes, sizesRes] = await Promise.all([
          supabaseAdmin.from("menu_categories").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
          supabaseAdmin.from("menu_items").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
          supabaseAdmin.from("pizzeria_beverages").select("*").eq("pizzeria_id", restaurant.id).order("sort_order"),
          supabaseAdmin.from("pizzeria_pizza_sizes").select("*").eq("pizzeria_id", restaurant.id).order("sort_order"),
        ]);

        const categories = catsRes.data || [];
        const productsRaw = itemsRes.data || [];
        const beverages = bevsRes.data || [];
        const pizzaSizes = sizesRes.data || [];

        const isBorda = (c: any) => c.name.toLowerCase().includes("borda");
        const isAdicional = (c: any) => c.name.toLowerCase().includes("adicional") || c.name.toLowerCase().includes("extra");

        const borders = productsRaw.filter(p => {
          const cat = categories.find(c => c.id === p.category_id);
          return cat && isBorda(cat);
        });

        const additionals = productsRaw.filter(p => {
          const cat = categories.find(c => c.id === p.category_id);
          return cat && isAdicional(cat);
        });

        const response = {
          success: true,
          restaurant: {
            slug: restaurant.slug,
            name: restaurant.name
          },
          menu: {
            categories: categories.map(c => ({ id: c.id, name: c.name, active: c.is_active ?? true, sort_order: c.sort_order, is_pizza: c.is_pizza, pizza_sizes: c.pizza_sizes })),
            products: productsRaw.filter(p => {
              const cat = categories.find(c => c.id === p.category_id);
              return !cat || (!isBorda(cat) && !isAdicional(cat));
            }).map(i => ({ id: i.id, category_id: i.category_id, name: i.name, description: i.description, price: i.price, image_url: i.image_url, active: i.is_active ?? true, sort_order: i.sort_order, is_special: i.is_special, special_extra: i.special_extra, sizes: i.sizes })),
            flavors: [],
            sizes: pizzaSizes.map(s => ({ id: s.id, name: s.name, price: Number(s.price), max_flavors: s.max_flavors, slices: s.slices, active: s.is_active ?? true, sort_order: s.sort_order })),
            borders: borders.map(b => ({ id: b.id, name: b.name, price: b.price, active: b.is_active ?? true })),
            drinks: beverages.map(b => ({ id: b.id, name: b.name, brand: b.brand, size: b.size, price: b.price, active: b.is_active ?? true })),
            addons: additionals.map(a => ({ id: a.id, name: a.name, price: a.price, active: a.is_active ?? true }))
          }
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      },
    },
  },
});
