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
           console.error(`[menu-sync] API Key inválida para ${slug}`);
          return new Response(JSON.stringify({ error: "API Key inválida" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

         console.log(`[menu-sync] Buscando cardápio para: ${restaurant.name} (${restaurant.id})`);

         const [cats, items, bevs, combos, zones] = await Promise.all([
          supabaseAdmin.from("menu_categories").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
          supabaseAdmin.from("menu_items").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
          supabaseAdmin.from("pizzeria_beverages").select("*").eq("pizzeria_id", restaurant.id).order("sort_order"),
           supabaseAdmin.from("combos").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
           supabaseAdmin.from("delivery_zones").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
        ]);

         const isBorda = (c: any) => c.name.toLowerCase().includes("borda") || c.name.toLowerCase().includes("fill");
         const isAdicional = (c: any) => c.name.toLowerCase().includes("adicional") || c.name.toLowerCase().includes("extra") || c.name.toLowerCase().includes("complemento");

         const categoriesData = cats.data || [];
         const productsRaw = items.data || [];

         const borders = productsRaw.filter(p => {
           const cat = categoriesData.find(c => c.id === p.category_id);
           return cat && isBorda(cat);
         });

         const additionals = productsRaw.filter(p => {
           const cat = categoriesData.find(c => c.id === p.category_id);
           return cat && isAdicional(cat);
         });

         console.log(`[menu-sync] Encontrados: ${cats.data?.length || 0} categorias, ${items.data?.length || 0} produtos, ${bevs.data?.length || 0} bebidas, ${zones.data?.length || 0} taxas.`);


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
              active: b.is_active,
              type: "beverage"
            })),
            borders: borders.map(b => ({
              id: b.id,
              pizzeria_id: restaurant.id,
              name: b.name,
              description: "",
              price: b.price,
              active: b.is_active ?? true,
              type: "border"
            })),
            additionals: additionals.map(a => ({
              id: a.id,
              pizzeria_id: restaurant.id,
              name: a.name,
              description: "",
              price: a.price,
              active: a.is_active ?? true,
              type: "additional"
            })),
             combos: (combos.data || []).map(c => ({
               id: c.id,
               name: c.name,
               description: c.badge,
               price: c.price,
               active: c.is_active ?? true,
               items: c.items,
               type: "combo"
             })),
             delivery_zones: (zones.data || []).map(z => ({
               id: z.id,
               neighborhood: z.neighborhood,
               fee: z.fee,
               sort_order: z.sort_order
             }))
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      },
    },
  },
});
