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
  const allowedOrigins = [
    "https://flycontrol-dash.lovable.app",
    "https://conectfly.com.br",
    "https://www.conectfly.com.br",
    "https://flycontrol.conectfly.com.br"
  ];
  
  const isDevelopment = origin && (origin.endsWith(".lovable.app") || origin.includes("localhost"));
  const isAllowed = origin && (allowedOrigins.includes(origin) || isDevelopment);
  
  return {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://conectfly.com.br",
  };
}

const mapFields = (body: any, type: string) => {
  const data: any = { ...body };
  
  if ('active' in data || 'available' in data) {
    data.is_active = data.active !== undefined ? data.active : data.available;
  }
  
  if ('highlight' in data) {
    data.is_highlighted = data.highlight;
  }
  
  if (type === 'combo' && 'description' in data) {
    data.badge = data.description;
  }

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

  Object.keys(data).forEach(key => {
    if (whitelist.includes(key)) {
      normalizedData[key] = data[key];
    }
  });
  
  return normalizedData;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    let slug = url.searchParams.get("slug");
    let syncToken = url.searchParams.get("sync_token") || url.searchParams.get("token");

    // Handle /menu-sync/:slug/:token
    const menuSyncIndex = pathParts.findIndex(p => p === "menu-sync");
    if (menuSyncIndex !== -1 && pathParts.length > menuSyncIndex + 2) {
      slug = pathParts[menuSyncIndex + 1];
      syncToken = pathParts[menuSyncIndex + 2];
    } else if (menuSyncIndex !== -1 && pathParts.length > menuSyncIndex + 1) {
      slug = pathParts[menuSyncIndex + 1];
    }

    const apiKeyHeader = req.headers.get("x-api-key") || req.headers.get("apikey") || req.headers.get("Authorization")?.replace("Bearer ", "");
    
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch (e) { console.error("Error parsing JSON:", e); }
      slug = slug || body.slug;
      syncToken = syncToken || body.sync_token || body.token;
    }

    console.log(`MENU_SYNC_DEBUG_START: slug_received=${slug} token_received_preview=${syncToken?.substring(0, 8)}...`);

    let restaurant;
    let authResult = "unauthorized";

    // 1. Validate by sync_token (Priority)
    if (slug && syncToken) {
      const { data: res, error: resError } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
      
      if (res) {
        restaurant = res;
        const storedToken = restaurant.menu_sync_token;
        const tokenMatch = storedToken === syncToken;
        
        console.log(`MENU_SYNC_RESTAURANT_LOOKUP: restaurant_found=true restaurant_id=${res.id} restaurant_slug=${res.slug} restaurant_name=${res.name}`);
        
        if (tokenMatch) {
          authResult = "success";
        } else {
          console.log(`MENU_SYNC_DEBUG: final_result=invalid_sync_token`);
          return new Response(JSON.stringify({ 
            success: false, 
            error: "invalid_sync_token", 
            message: "Token de sincronização inválido.",
          }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        console.log(`MENU_SYNC_DEBUG: final_result=restaurant_not_found`);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "restaurant_not_found", 
          message: "Restaurante não encontrado." 
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 2. Validate by API Key (Fallback for legacy)
    if (authResult !== "success" && apiKeyHeader) {
      const { data: res } = await supabase.from("restaurants").select("*").eq("flycontrol_api_key", apiKeyHeader).maybeSingle();
      if (res) {
        restaurant = res;
        authResult = "success";
      }
    }

    if (authResult !== "success") {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "unauthorized", 
        message: "Autorização necessária (API Key ou sync_token)." 
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!restaurant) return new Response(JSON.stringify({ success: false, error: "not_found" }), { status: 404, headers: corsHeaders });

    // GET: Return Menu Data
    if (req.method === "GET") {
      console.log(`MENU_SYNC_DATA_SOURCES: categories_table_used=menu_categories products_table_used=menu_items beverage_catalogs_table_used=beverage_catalogs drinks_table_used=pizzeria_beverages`);

      const [catsRes, itemsRes, bevsRes, sizesRes, catalogsRes, combosRes] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
        supabase.from("menu_items").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
        supabase.from("pizzeria_beverages").select("*").eq("pizzeria_id", restaurant.id).order("sort_order"),
        supabase.from("pizzeria_pizza_sizes").select("*").eq("pizzeria_id", restaurant.id).order("sort_order"),
        supabase.from("beverage_catalogs").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
        supabase.from("combos").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
      ]);

      const categories = catsRes.data || [];
      const productsRaw = itemsRes.data || [];
      const beverages = bevsRes.data || [];
      const pizzaSizes = sizesRes.data || [];
      const catalogs = catalogsRes.data || [];
      const combos = combosRes.data || [];

      console.log(`MENU_SYNC_COUNTS: categories_count=${categories.length} products_count=${productsRaw.length} drinks_count=${beverages.length} beverage_catalogs_count=${catalogs.length} combos_count=${combos.length}`);

      const isBorda = (c: any) => c.name.toLowerCase().includes("borda");
      const isAdicional = (c: any) => c.name.toLowerCase().includes("adicional") || c.name.toLowerCase().includes("extra");

      const normalizedProducts: any[] = [];

      // Add regular products
      productsRaw.forEach(i => {
        const cat = categories.find(c => c.id === i.category_id);
        normalizedProducts.push({
          external_id: `sf_prod_${i.id}`,
          name: i.name,
          description: i.description || "",
          price: i.price,
          image_url: i.image_url || "",
          category_name: cat?.name || "Geral",
          type: "product",
          is_active: i.is_active ?? true
        });
      });

      // Add beverages
      beverages.forEach(b => {
        const cat = catalogs.find(c => c.id === b.catalog_id);
        normalizedProducts.push({
          external_id: `sf_drink_${b.id}`,
          name: b.name,
          description: b.description || b.brand || "",
          price: b.price,
          image_url: b.image_url || "",
          category_name: cat?.name || "Bebidas",
          type: "drink",
          is_active: b.is_active ?? true
        });
      });

      // Add combos
      combos.forEach(c => {
        normalizedProducts.push({
          external_id: `sf_combo_${c.id}`,
          name: c.name,
          description: c.badge || "",
          price: c.price,
          image_url: "",
          category_name: "Combos",
          type: "combo",
          is_active: c.is_active ?? true
        });
      });

      const borders = productsRaw.filter(p => {
        const cat = categories.find(c => c.id === p.category_id);
        return cat && isBorda(cat);
      });

      const additionals = productsRaw.filter(p => {
        const cat = categories.find(c => c.id === p.category_id);
        return cat && isAdicional(cat);
      });

      console.log(`MENU_SYNC_SAMPLE: first_category_name=${categories[0]?.name} first_product_name=${productsRaw[0]?.name} first_drink_name=${beverages[0]?.name} first_normalized_product_name=${normalizedProducts[0]?.name}`);
      
      if (normalizedProducts.length === 0) {
        console.log(`MENU_SYNC_FINAL_RESPONSE: success=false error=empty_menu_sync_payload`);
        return new Response(JSON.stringify({
          success: false,
          error: "empty_menu_sync_payload",
          message: "Nenhum item vendável foi encontrado para este restaurante.",
          debug: {
            restaurant_id: restaurant.id,
            slug: restaurant.slug,
            categories_count: categories.length,
            products_count: productsRaw.length,
            drinks_count: beverages.length,
            normalized_products_count: 0
          }
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`MENU_SYNC_FINAL_RESPONSE: success=true total_items=${normalizedProducts.length}`);

      const response = {
        success: true,
        restaurant: {
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name
        },
        menu: {
          categories: categories.map(c => ({ id: c.id, name: c.name, active: c.is_active ?? true, sort_order: c.sort_order, is_pizza: c.is_pizza })),
          products: productsRaw.map(i => ({ id: i.id, category_id: i.category_id, name: i.name, description: i.description, price: i.price, image_url: i.image_url, active: i.is_active ?? true })),
          flavors: [],
          sizes: pizzaSizes.map(s => ({ id: s.id, name: s.name, price: Number(s.price), max_flavors: s.max_flavors, slices: s.slices, active: s.is_active ?? true })),
          borders: borders.map(b => ({ id: b.id, name: b.name, price: b.price, active: b.is_active ?? true })),
          drinks: beverages.map(b => ({ id: b.id, name: b.name, brand: b.brand, size: b.size, price: b.price, active: b.is_active ?? true })),
          addons: additionals.map(a => ({ id: a.id, name: a.name, price: a.price, active: a.is_active ?? true })),
          beverage_catalogs: catalogs,
          combos: combos,
          normalized_products: normalizedProducts
        }
      };

      return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST handling remains for sync from FlyControl
    if (req.method === "POST") {
      const action = body.action;
      const type = body.type;
      const id = body.id;
      
      if (!type) return new Response(JSON.stringify({ success: false, error: "Type missing" }), { status: 400, headers: corsHeaders });

      let table = "";
      let resField = "restaurant_id";
      if (type === "product" || type === "border" || type === "additional") table = "menu_items";
      else if (type === "category") table = "menu_categories";
      else if (type === "beverage") { table = "pizzeria_beverages"; resField = "pizzeria_id"; }
      else if (type === "pizza_size") { table = "pizzeria_pizza_sizes"; resField = "pizzeria_id"; }
      else return new Response(JSON.stringify({ success: false, error: "Invalid type" }), { status: 400, headers: corsHeaders });

      if (action === "create") {
        const data = { ...mapFields(body.data || body, type), [resField]: restaurant.id };
        const { data: result, error } = await supabase.from(table).insert(data).select().single();
        if (error) return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true, item: result }), { status: 201, headers: corsHeaders });
      }

      if (!id) return new Response(JSON.stringify({ success: false, error: "ID missing" }), { status: 400, headers: corsHeaders });

      if (action === "update" || action === "status") {
        const updateData = action === "status" ? { is_active: body.active ?? body.is_active } : mapFields(body.data || body, type);
        const { data: result, error } = await supabase.from(table).update(updateData).eq("id", id).eq(resField, restaurant.id).select().maybeSingle();
        if (error) return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        if (!result) return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true, item: result }), { headers: corsHeaders });
      }

      if (action === "delete") {
        const { error } = await supabase.from(table).update({ is_active: false }).eq("id", id).eq(resField, restaurant.id);
        if (error) return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error("Critical error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
});