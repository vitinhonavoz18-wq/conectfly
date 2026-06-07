 import { serve } from "std/http/server.ts";
 import { createClient } from "supabase";
 
 const CORS_HEADERS = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "content-type, x-api-key, apikey, authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
   "Access-Control-Allow-Credentials": "true",
 };
 
  function getCorsHeaders(req: Request) {
    const origin = req.headers.get("Origin");
    
    // Lista explícita de origens permitidas (sem substrings frágeis para produção)
    const allowedOrigins = [
      "https://flycontrol-dash.lovable.app",
      "https://conectfly.com.br",
      "https://www.conectfly.com.br"
    ];
    
    // No ambiente de desenvolvimento do Lovable, permitimos subdomínios .lovable.app
    const isDevelopment = origin && origin.endsWith(".lovable.app");
    const isAllowed = origin && (allowedOrigins.includes(origin) || isDevelopment || origin.includes("localhost"));
    
    return {
      ...CORS_HEADERS,
      "Access-Control-Allow-Origin": isAllowed ? origin : "https://conectfly.com.br",
    };
  }
 
  const mapFields = (body: any, type: string) => {
    const originalData = { ...body };
    const data: any = { ...body };
    
    console.log(`[menu-sync] Normalizing payload for type=${type}. Original:`, JSON.stringify(originalData));

    // 1. Basic normalization of common fields
    if ('active' in data || 'available' in data) {
      data.is_active = data.active !== undefined ? data.active : data.available;
    }
    
    if ('highlight' in data) {
      data.is_highlighted = data.highlight;
    }
    
    if (type === 'combo' && 'description' in data) {
      data.badge = data.description;
    }

    // 2. Define Whitelists (strictly based on DB schema)
    const whitelists: Record<string, string[]> = {
      'product': ['name', 'description', 'price', 'image_url', 'category_id', 'is_active', 'sort_order', 'is_special', 'special_extra', 'sizes'],
      'beverage': ['name', 'brand', 'size', 'price', 'is_active', 'sort_order'],
      'border': ['name', 'price', 'is_active', 'sort_order', 'category_id'],
      'additional': ['name', 'price', 'is_active', 'sort_order', 'category_id'],
      'category': ['name', 'icon', 'image_url', 'sort_order', 'is_pizza', 'pizza_sizes', 'is_active'],
      'combo': ['name', 'items', 'price', 'badge', 'sort_order', 'is_active', 'is_highlighted'],
       'delivery-zone': ['neighborhood', 'fee', 'sort_order'],
       'pizza_size': ['name', 'price', 'max_flavors', 'slices', 'is_active', 'sort_order']
    };

    const whitelist = whitelists[type] || [];
    const normalizedData: any = {};
    const removedFields: string[] = [];

    // 3. Apply whitelist
    Object.keys(data).forEach(key => {
      if (whitelist.includes(key)) {
        normalizedData[key] = data[key];
      } else {
        removedFields.push(key);
      }
    });

    console.log(`[menu-sync] Normalized payload for ${type}:`, JSON.stringify(normalizedData));
    if (removedFields.length > 0) {
      console.log(`[menu-sync] Fields removed for ${type}:`, removedFields.join(', '));
    }
    
    return normalizedData;
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
      const pathParts = url.pathname.split("/").filter(Boolean);
      
      // New exclusive public route: /api/public/menu-sync/:slug/:token
      // Depending on how it's called via Edge Function, path might be different.
      // Usually it's /menu-sync/slug/token
      
      let slug = url.searchParams.get("slug");
      let syncToken = url.searchParams.get("sync_token") || url.searchParams.get("syncToken") || url.searchParams.get("token");

      // Check for the new URL pattern /menu-sync/:slug/:token
      // pathParts might be ["menu-sync", "slug", "token"]
      if (pathParts.length >= 3 && pathParts[0] === "menu-sync") {
        slug = pathParts[1];
        syncToken = pathParts[2];
        console.log(`PUBLIC_MENU_SYNC_REQUEST: slug_received=${slug} token_received_preview=${syncToken?.substring(0, 6)}...`);
      }

      const apiKey = req.headers.get("x-api-key") || req.headers.get("apikey") || req.headers.get("Authorization")?.replace("Bearer ", "");
      
      let body: any = {};
      if (method === "POST") {
        try {
          body = await req.json();
          slug = slug || body.slug;
          syncToken = syncToken || body.sync_token || body.syncToken || body.token;
        } catch (e) {
          console.error("[menu-sync] Error parsing JSON body:", e);
        }
      }

      console.log(`MENU_SYNC_AUTH_DEBUG: slug=${slug} has_sync_token=${!!syncToken} has_api_key=${!!apiKey}`);

      let pizzeria;
      let authMethodUsed = "none";
      let authResult = "pending";

      // 1. Check sync_token first (Priority for FlyControl and Public Link)
      if (slug && syncToken) {
        const { data: res } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
        pizzeria = res;
        
        if (pizzeria) {
          console.log(`PUBLIC_MENU_SYNC_RESTAURANT_FOUND: restaurant_id=${pizzeria.id} slug=${pizzeria.slug}`);
          
          const storedToken = pizzeria.menu_sync_token;
          const tokenMatch = storedToken && syncToken === storedToken;
          
          console.log(`PUBLIC_MENU_SYNC_TOKEN_VALIDATION: stored_token_exists=${!!storedToken} token_match=${tokenMatch}`);
          
          if (tokenMatch) {
            authMethodUsed = "sync_token";
            authResult = "success";
          } else {
            authResult = "invalid_token";
            return new Response(JSON.stringify({ 
              success: false, 
              error: "invalid_sync_token",
              message: "Token de sincronização inválido." 
            }), {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
        } else {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "restaurant_not_found", 
            message: "Restaurante não encontrado."
          }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // 2. Fallback to API Key if not already authorized by token (for legacy/other clients)
      if (authResult !== "success" && apiKey) {
        const { data: res } = await supabase.from("restaurants").select("*").eq("flycontrol_api_key", apiKey).maybeSingle();
        if (res) {
          pizzeria = res;
          authMethodUsed = "api_key";
          authResult = "success";
          console.log(`MENU_SYNC_AUTH_DEBUG: Authorized by API Key for slug=${pizzeria.slug}`);
        }
      }

      // 3. Final authorization check
      if (authResult !== "success") {
        console.log(`MENU_SYNC_AUTH_DEBUG: Final Auth Result = unauthorized. Method used: ${authMethodUsed}`);
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: "unauthorized",
          message: "API Key ou Token de sincronização obrigatórios." 
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      console.log(`MENU_SYNC_AUTH_DEBUG: Final Auth Result = success. Method used: ${authMethodUsed}`);


 
      if (!pizzeria) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "restaurant_not_found", 
          message: "Restaurante não encontrado.",
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
       
       const [catsRes, itemsRes, groupsRes, combosRes, zonesRes, beveragesRes, sizesRes] = await Promise.all([
         supabase.from("menu_categories").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("combo_groups").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("combos").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("delivery_zones").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
         supabase.from("pizzeria_beverages").select("*").eq("pizzeria_id", restaurantId).order("sort_order"),
          supabase.from("pizzeria_pizza_sizes").select("*").eq("pizzeria_id", restaurantId).order("sort_order"),
       ]);
 
       const categories = catsRes.data || [];
       const productsRaw = itemsRes.data || [];
       const combos = combosRes.data || [];
       const beverages = beveragesRes.data || [];
        const deliveryZones = zonesRes.data || [];
        const pizzaSizes = sizesRes.data || [];
 
        const isBorda = (c: any) => c.name.toLowerCase().includes("borda") || c.name.toLowerCase().includes("fill");
        const isAdicional = (c: any) => c.name.toLowerCase().includes("adicional") || c.name.toLowerCase().includes("extra") || c.name.toLowerCase().includes("complemento");
 
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
          restaurant: { name: pizzeria.name, slug: pizzeria.slug },
          menu: {
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
              id: b.id, name: b.name, description: "", brand: b.brand, size: b.size, price: b.price,
              active: b.is_active ?? true, updated_at: b.updated_at, type: "beverage"
            })),
            borders: borders.map(b => ({
              id: b.id, pizzeria_id: restaurantId, name: b.name, description: "", price: b.price,
              active: b.is_active ?? true, updated_at: b.updated_at, type: "border"
            })),
            additionals: additionals.map(a => ({
              id: a.id, pizzeria_id: restaurantId, name: a.name, description: "", price: a.price,
              active: a.is_active ?? true, updated_at: a.updated_at, type: "additional"
            })),
            flavors: [],
            sizes: pizzaSizes.map(s => ({
              id: s.id, name: s.name, price: Number(s.price), max_flavors: s.max_flavors, 
              slices: s.slices, active: s.is_active ?? true, sort_order: s.sort_order, updated_at: s.updated_at
            })),
            combos: combos.map(c => ({
              id: c.id, name: c.name, description: c.badge, price: c.price,
              active: c.is_active ?? true, items: c.items, updated_at: c.updated_at
            })),
            delivery_zones: deliveryZones.map(z => ({
              id: z.id, neighborhood: z.neighborhood, fee: z.fee, sort_order: z.sort_order, updated_at: z.updated_at
            }))
          }
        };
 
       return new Response(JSON.stringify(response), {
         headers: { ...corsHeaders, "Content-Type": "application/json" }
       });
     }
 
    // Write operations (POST only for actions)
    if (method === "POST") {
      if (method === "POST" && authMethodUsed !== "api_key") {
        return new Response(JSON.stringify({ success: false, error: "API Key é obrigatória para escrita" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }


      const action = body.action;
      const type = body.type;
      const id = body.id;
      
      console.log(`[menu-sync] Write Operation: action=${action}, type=${type}, id=${id}`);
 
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
       else if (type === "pizza_size") { table = "pizzeria_pizza_sizes"; resField = "pizzeria_id"; }
      else return new Response(JSON.stringify({ success: false, error: "Tipo inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      console.log(`[menu-sync] Target table: ${table}`);

      if (action === "create") {
        const insertData = body.data || body;
        const data = { ...mapFields(insertData, type), [resField]: restaurantId };
        const { data: res, error } = await supabase.from(table).insert(data).select().single();
        if (error) {
          console.error(`[menu-sync] Create Error:`, error);
          return new Response(JSON.stringify({ success: false, error: error.message, details: error }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: true, message: "Item criado com sucesso", item: res }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!id) return new Response(JSON.stringify({ success: false, error: "ID obrigatório para esta ação" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (action === "update" || action === "status") {
        let updateData;
        if (action === "status") {
          // Normalize status update
          const activeVal = body.active !== undefined ? body.active : 
                           (body.available !== undefined ? body.available : body.is_active);
          updateData = { is_active: activeVal };
        } else {
          const fields = body.data || body;
          updateData = mapFields(fields, type);
        }
        
        console.log(`[menu-sync] Updating ${table} id=${id}. Normalized payload:`, JSON.stringify(updateData));
        
        const { data: res, error } = await supabase.from(table)
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq(resField, restaurantId)
          .select()
          .maybeSingle();
          
        if (error) {
          console.error(`[menu-sync] Update Error:`, error);
          return new Response(JSON.stringify({ success: false, error: error.message, details: error }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (!res) return new Response(JSON.stringify({ success: false, error: "Item não encontrado ou sem permissão" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ success: true, message: "Item atualizado com sucesso", item: res }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action === "delete") {
        // Soft delete
        const { data: res, error } = await supabase.from(table)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq(resField, restaurantId)
          .select()
          .maybeSingle();
          
        if (error) {
          console.error(`[menu-sync] Delete Error:`, error);
          return new Response(JSON.stringify({ success: false, error: error.message, details: error }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: true, message: "Item removido (desativado) com sucesso", item: res }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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