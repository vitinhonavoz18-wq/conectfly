 import { serve } from "std/http/server.ts";
 import { createClient } from "supabase";
 
 const CORS_HEADERS = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "content-type, x-api-key, apikey, authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
   "Access-Control-Allow-Credentials": "true",
 };
 
 function getCorsHeaders(req: Request) {
   const origin = req.headers.get("Origin");
   const allowedOrigins = [
     "https://flycontrol-dash.lovable.app",
     "https://preview--flycontrol-dash.lovable.app",
     "https://preview--flycontrol-dsh.lovable.app",
     "https://conectfly.lovable.app"
   ];
   
   const isAllowed = origin && (
     allowedOrigins.includes(origin) || 
     origin.endsWith(".lovable.app") ||
     origin.includes("localhost")
   );
   
   return {
     ...CORS_HEADERS,
     "Access-Control-Allow-Origin": isAllowed ? origin : "*",
   };
 }
 
 const mapFields = (body: any, type: string) => {
   const data = { ...body };
   if ('active' in data) {
     data.is_active = data.active;
     delete data.active;
   }
   if ('highlight' in data) {
     data.is_highlighted = data.highlight;
     delete data.highlight;
   }
   if (type === 'combo' && 'description' in data) {
     data.badge = data.description;
     delete data.description;
   }
   delete data.id;
   delete data.restaurant_id;
   delete data.pizzeria_id;
   return data;
 };
 
 serve(async (req) => {
   const corsHeaders = getCorsHeaders(req);
   const method = req.method;
   
   if (method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseKey);
 
     const url = new URL(req.url);
     const slug = url.searchParams.get("slug");
      const apiKey = req.headers.get("x-api-key") || req.headers.get("apikey") || req.headers.get("Authorization")?.replace("Bearer ", "");
     
     // Identify pizzeria
     let pizzeria;
     if (apiKey) {
       const { data } = await supabase.from("restaurants").select("*").eq("flycontrol_api_key", apiKey).maybeSingle();
       pizzeria = data;
     } else if (slug) {
       const { data } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
       pizzeria = data;
     }
 
     if (!pizzeria) {
       return new Response(JSON.stringify({ 
         success: false, 
         error: "Pizzaria não encontrada", 
         slug: slug || "não fornecido" 
       }), {
         status: 404,
         headers: { ...corsHeaders, "Content-Type": "application/json" }
       });
     }
 
     const restaurantId = pizzeria.id;
 
     // GET: Sync Full Menu
     if (method === "GET") {
       console.log(`[menu-sync] GET Sync for \${pizzeria.slug}`);
       
       const [catsRes, itemsRes, groupsRes, combosRes, zonesRes, beveragesRes] = await Promise.all([
         supabase.from("menu_categories").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("combo_groups").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("combos").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("delivery_zones").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("pizzeria_beverages").select("*").eq("pizzeria_id", restaurantId).order("sort_order"),
       ]);
 
       const categories = catsRes.data || [];
       const productsRaw = itemsRes.data || [];
       const combos = combosRes.data || [];
       const beverages = beveragesRes.data || [];
       const deliveryZones = zonesRes.data || [];
 
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
         pizzeria: { id: pizzeria.id, name: pizzeria.name, slug: pizzeria.slug },
         categories: categories.map(c => ({
           id: c.id, name: c.name, active: c.is_active ?? true, sort_order: c.sort_order,
           is_pizza: c.is_pizza, pizza_sizes: c.pizza_sizes, updated_at: c.updated_at
         })),
         products: productsRaw.map(i => ({
           id: i.id, category_id: i.category_id, name: i.name, description: i.description,
           price: i.price, image_url: i.image_url, active: i.is_active ?? true,
           sort_order: i.sort_order, is_special: i.is_special, special_extra: i.special_extra,
           sizes: i.sizes, updated_at: i.updated_at
         })),
         beverages: beverages.map(b => ({
           id: b.id, name: b.name, brand: b.brand, size: b.size, price: b.price,
           active: b.is_active ?? true, updated_at: b.updated_at
         })),
         borders: borders.map(b => ({
           id: b.id, pizzeria_id: restaurantId, name: b.name, price: b.price,
           active: b.is_active ?? true, updated_at: b.updated_at
         })),
         additionals: additionals.map(a => ({
           id: a.id, pizzeria_id: restaurantId, name: a.name, price: a.price,
           active: a.is_active ?? true, updated_at: a.updated_at
         })),
         combos: combos.map(c => ({
           id: c.id, name: c.name, description: c.badge, price: c.price,
           active: c.is_active ?? true, items: c.items, updated_at: c.updated_at
         })),
         delivery_zones: deliveryZones.map(z => ({
           id: z.id, neighborhood: z.neighborhood, fee: z.fee, sort_order: z.sort_order, updated_at: z.updated_at
         }))
       };
 
       return new Response(JSON.stringify(response), {
         headers: { ...corsHeaders, "Content-Type": "application/json" }
       });
     }
 
     // Write operations (POST, PUT, PATCH)
     if (!apiKey) {
       return new Response(JSON.stringify({ success: false, error: "API Key é obrigatória para escrita" }), {
         status: 401,
         headers: { ...corsHeaders, "Content-Type": "application/json" }
       });
     }
 
      let body: any = {};
      try {
        if (method !== "GET" && method !== "OPTIONS") {
          body = await req.json();
        }
      } catch (e) {
        console.log("No body found or invalid JSON");
      }

      const pathParts = url.pathname.split("/").filter(p => p && p !== "menu-sync" && p !== "functions" && p !== "v1");
      
      let action = body.action;
      let type = body.type || pathParts[0];
      let id = body.id || pathParts[1];

      if (method === "PATCH" && !action) action = "status";
      if (method === "DELETE" && !action) action = "delete";
      if (method === "PUT" && !action) action = "update";
      if (method === "POST" && !action) action = "create";
 
     if (!type) {
       return new Response(JSON.stringify({ success: false, error: "Tipo de item não especificado" }), {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" }
       });
     }
 
     let table = "";
     let resField = "restaurant_id";
     if (type === "product" || type === "border" || type === "additional") table = "menu_items";
     else if (type === "category") table = "menu_categories";
     else if (type === "beverage") { table = "pizzeria_beverages"; resField = "pizzeria_id"; }
     else if (type === "combo") table = "combos";
     else if (type === "delivery-zone") table = "delivery_zones";
     else return new Response(JSON.stringify({ success: false, error: "Tipo inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
 
      if (method === "POST" || action === "create") {
        const insertData = body.data || body;
        const data = { ...mapFields(insertData, type), [resField]: restaurantId };
       const { data: res, error } = await supabase.from(table).insert(data).select().single();
        if (error) {
          console.error(`[menu-sync] Create Error:`, error);
          throw error;
        }
        return new Response(JSON.stringify({ success: true, message: "Item criado com sucesso", item: res }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
     }
 
     if (!id) return new Response(JSON.stringify({ success: false, error: "ID obrigatório para edição" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
 
      if (method === "PUT" || method === "PATCH" || action === "update" || action === "status") {
        let updateData;
        if (action === "status") {
          updateData = { is_active: body.active !== undefined ? body.active : body.is_active };
        } else {
          const fields = body.data || body;
          updateData = mapFields(fields, type);
       }
        
        const { data: res, error } = await supabase.from(table)
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq(resField, restaurantId)
          .select()
          .maybeSingle();
          
       if (error) throw error;
       if (!res) return new Response(JSON.stringify({ success: false, error: "Item não encontrado ou sem permissão" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ success: true, message: "Item atualizado com sucesso", item: res }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
     }
 
      if (method === "DELETE" || action === "delete") {
        // Soft delete
        const { data: res, error } = await supabase.from(table)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq(resField, restaurantId)
          .select()
          .maybeSingle();
          
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Item removido (desativado) com sucesso", item: res }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

     return new Response(JSON.stringify({ success: false, error: "Método não suportado" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
 
   } catch (error) {
     console.error(`[menu-sync] Error:`, error);
     return new Response(JSON.stringify({ success: false, error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" }
     });
   }
 });