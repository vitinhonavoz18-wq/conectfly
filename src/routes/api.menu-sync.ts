import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export const Route = createFileRoute("/api/menu-sync")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: corsHeaders }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const slug = url.searchParams.get("slug");

          console.log(`[menu-sync] 🔍 Requisição recebida para slug: "${slug}"`);

          if (!slug) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Parâmetro 'slug' é obrigatório" 
            }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Usar pizzerias_public para garantir que estamos pegando o que aparece no site
          const { data: restaurant, error: rErr } = await supabaseAdmin
            .from("pizzerias_public")
            .select("*")
            .eq("slug", slug)
            .maybeSingle();

          if (rErr || !restaurant) {
            console.warn(`[menu-sync] ❌ Pizzaria não encontrada para o slug: "${slug}"`);
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Pizzaria não encontrada",
              slug 
            }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          console.log(`[menu-sync] ✅ Pizzaria encontrada: ${restaurant.name} (${restaurant.id})`);

          // Buscar todos os dados do cardápio usando a mesma lógica que o site público
          const [catsRes, itemsRes, groupsRes, combosRes, zonesRes, beveragesRes] = await Promise.all([
            supabaseAdmin
              .from("menu_categories")
              .select("*")
              .eq("restaurant_id", restaurant.id)
              .order("sort_order"),
            supabaseAdmin
              .from("menu_items")
              .select("*")
              .eq("restaurant_id", restaurant.id)
              .order("sort_order"),
            supabaseAdmin
              .from("combo_groups")
              .select("*")
              .eq("restaurant_id", restaurant.id)
              .order("sort_order"),
            supabaseAdmin
              .from("combos")
              .select("*")
              .eq("restaurant_id", restaurant.id)
              .order("sort_order"),
            supabaseAdmin
              .from("delivery_zones")
              .select("*")
              .eq("restaurant_id", restaurant.id)
              .order("sort_order"),
            supabaseAdmin
              .from("pizzeria_beverages")
              .select("*")
              .eq("pizzeria_id", restaurant.id)
              .order("sort_order"),
          ]);

          const categories = catsRes.data || [];
          const products = itemsRes.data || [];
          const combos = combosRes.data || [];
          const beverages = beveragesRes.data || [];
          const deliveryZones = zonesRes.data || [];

          console.log(`[menu-sync] 📊 Dados encontrados: 
            - Categorias: ${categories.length}
            - Produtos: ${products.length}
            - Bebidas: ${beverages.length}
            - Combos: ${combos.length}
            - Taxas de entrega: ${deliveryZones.length}`);

          // Separar bordas e adicionais das categorias se existirem
          // No SiteCreatorFly, as bordas são tratadas como categorias normais com flag ou nome específico
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
              pizza_sizes: c.pizza_sizes
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
              sizes: i.sizes
            })),
            beverages: beverages.map(b => ({
              id: b.id,
              name: b.name,
              brand: b.brand,
              size: b.size,
              price: b.price,
              active: b.is_active ?? true
            })),
            borders: borders.map(b => ({
              id: b.id,
              pizzeria_id: restaurant.id,
              name: b.name,
              price: b.price,
              active: b.is_active ?? true
            })),
            additionals: additionals.map(a => ({
              id: a.id,
              pizzeria_id: restaurant.id,
              name: a.name,
              price: a.price,
              active: a.is_active ?? true
            })),
            combos: combos.map(c => ({
              id: c.id,
              name: c.name,
              description: c.badge,
              price: c.price,
              active: c.is_active ?? true,
              items: c.items
            })),
            delivery_zones: deliveryZones.map(z => ({
              id: z.id,
              neighborhood: z.neighborhood,
              fee: z.fee,
              sort_order: z.sort_order
            }))
          };

          if (categories.length === 0 && products.length === 0) {
            (response as any).message = "Cardápio encontrado, mas sem itens cadastrados.";
          }

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