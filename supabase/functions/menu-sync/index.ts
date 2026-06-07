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
    if (pathParts.length >= 3 && pathParts[0] === "menu-sync") {
      slug = pathParts[1];
      syncToken = pathParts[2];
    } else if (pathParts.length === 2 && pathParts[0] === "menu-sync") {
      slug = pathParts[1];
    }

    const apiKeyHeader = req.headers.get("x-api-key") || req.headers.get("apikey") || req.headers.get("Authorization")?.replace("Bearer ", "");
    
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch (e) { console.error("Error parsing JSON:", e); }
      slug = slug || body.slug;
      syncToken = syncToken || body.sync_token || body.token;
    }

    console.log(`MENU_SYNC_AUTH: slug=${slug} token=${!!syncToken} apiKey=${!!apiKeyHeader}`);

    let restaurant;
    let authResult = "unauthorized";

    // 1. Validate by sync_token (Priority)
    if (slug && syncToken) {
      const { data: res } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
      if (res) {
        restaurant = res;
        if (restaurant.menu_sync_token === syncToken) {
          authResult = "success";
          console.log(`MENU_SYNC: Authorized by token for ${slug}`);
        } else {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "invalid_sync_token", 
            message: "Token de sincronização inválido." 
          }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
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
        console.log(`MENU_SYNC: Authorized by API Key for ${restaurant.slug}`);
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
      const [catsRes, itemsRes, bevsRes, sizesRes] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
        supabase.from("menu_items").select("*").eq("restaurant_id", restaurant.id).order("sort_order"),
        supabase.from("pizzeria_beverages").select("*").eq("pizzeria_id", restaurant.id).order("sort_order"),
        supabase.from("pizzeria_pizza_sizes").select("*").eq("pizzeria_id", restaurant.id).order("sort_order"),
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
          flavors: [], // To be implemented if needed
          sizes: pizzaSizes.map(s => ({ id: s.id, name: s.name, price: Number(s.price), max_flavors: s.max_flavors, slices: s.slices, active: s.is_active ?? true, sort_order: s.sort_order })),
          borders: borders.map(b => ({ id: b.id, name: b.name, price: b.price, active: b.is_active ?? true })),
          drinks: beverages.map(b => ({ id: b.id, name: b.name, brand: b.brand, size: b.size, price: b.price, active: b.is_active ?? true })),
          addons: additionals.map(a => ({ id: a.id, name: a.name, price: a.price, active: a.is_active ?? true }))
        }
      };

      return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST: Manage Menu (Requires API Key for legacy, but we'll allow it if token is valid for now, though usually POST is for sync from FlyControl)
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
