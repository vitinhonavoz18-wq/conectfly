import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateApiKey } from "@/lib/api-auth";

const allowedOrigins = [
  "https://flycontrol-dash.lovable.app",
  "https://preview--flycontrol-dash.lovable.app"
];

const getCorsHeaders = (request: Request) => {
  const origin = request.headers.get("Origin");
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "*",
    "Access-Control-Allow-Headers": "content-type, x-api-key, authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
};

const mapFields = (body: any) => {
  const data = { ...body };
  // Map 'active' to 'is_active' if present
  if ('active' in data) {
    data.is_active = data.active;
    delete data.active;
  }
  // Remove ID and restaurant/pizzeria IDs to prevent changing ownership or primary keys
  delete data.id;
  delete data.restaurant_id;
  delete data.pizzeria_id;
  return data;
};

export const Route = createFileRoute("/api/menu-sync/$")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { headers: getCorsHeaders(request) }),
      
      POST: async ({ request, params }: { request: Request; params: any }) => {
        const corsHeaders = getCorsHeaders(request);
        const auth = await validateApiKey(request);
        if (auth.error || !auth.restaurant) {
          return new Response(JSON.stringify({ success: false, error: auth.error || "Unauthorized" }), {
            status: auth.status || 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const restaurant = auth.restaurant;
        const path = params._splat || "";
        const body = await request.json();

        console.log(`[menu-sync] 🆕 POST request for ${path} (restaurant: ${restaurant.slug})`);

        try {
          let table = "";
          let mappedData = mapFields(body);
          let dataWithOwnership: any;

          if (path === "product" || path === "border" || path === "additional") {
            table = "menu_items";
            dataWithOwnership = { ...mappedData, restaurant_id: restaurant.id };
          } else if (path === "category") {
            table = "menu_categories";
            dataWithOwnership = { ...mappedData, restaurant_id: restaurant.id };
          } else if (path === "beverage") {
            table = "pizzeria_beverages";
            dataWithOwnership = { ...mappedData, pizzeria_id: restaurant.id };
          } else if (path === "combo") {
            table = "combos";
            dataWithOwnership = { ...mappedData, restaurant_id: restaurant.id };
          } else if (path === "delivery-zone") {
            table = "delivery_zones";
            dataWithOwnership = { ...mappedData, restaurant_id: restaurant.id };
          } else {
            return new Response(JSON.stringify({ success: false, error: "Invalid path" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const { data: result, error } = await (supabaseAdmin
            .from(table as any) as any)
            .insert(dataWithOwnership)
            .select()
            .single();

          if (error) throw error;

          return new Response(JSON.stringify({ success: true, data: result }), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error(`[menu-sync] 💥 Error in POST ${path}:`, err);
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      },

      PUT: async ({ request, params }: { request: Request; params: any }) => {
        const corsHeaders = getCorsHeaders(request);
        const auth = await validateApiKey(request);
        if (auth.error || !auth.restaurant) {
          return new Response(JSON.stringify({ success: false, error: auth.error || "Unauthorized" }), {
            status: auth.status || 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const restaurant = auth.restaurant;
        const splat = (params._splat || "").split("/");
        const type = splat[0];
        const id = splat[1];
        const body = await request.json();

        if (!id) {
          return new Response(JSON.stringify({ success: false, error: "ID is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[menu-sync] 📝 PUT request for ${type}/${id} (restaurant: ${restaurant.slug})`);

        try {
          let table = "";
          let restaurantField = "restaurant_id";
          let mappedData = mapFields(body);

          if (type === "product" || type === "border" || type === "additional") table = "menu_items";
          else if (type === "category") table = "menu_categories";
          else if (type === "beverage") {
            table = "pizzeria_beverages";
            restaurantField = "pizzeria_id";
          } else if (type === "combo") table = "combos";
          else if (type === "delivery-zone") table = "delivery_zones";
          else {
            return new Response(JSON.stringify({ success: false, error: "Invalid type" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const { data: result, error } = await (supabaseAdmin
            .from(table as any) as any)
            .update(mappedData)
            .eq("id", id)
            .eq(restaurantField, restaurant.id)
            .select()
            .maybeSingle();

          if (error) throw error;
          if (!result) {
            return new Response(JSON.stringify({ success: false, error: "Record not found or unauthorized" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ success: true, data: result }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error(`[menu-sync] 💥 Error in PUT ${type}/${id}:`, err);
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      },

      PATCH: async ({ request, params }: { request: Request; params: any }) => {
        const corsHeaders = getCorsHeaders(request);
        const auth = await validateApiKey(request);
        if (auth.error || !auth.restaurant) {
          return new Response(JSON.stringify({ success: false, error: auth.error || "Unauthorized" }), {
            status: auth.status || 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const restaurant = auth.restaurant;
        const splat = (params._splat || "").split("/");
        const type = splat[0];
        const id = splat[1];
        const action = splat[2];
        const body = await request.json();

        if (!id) {
          return new Response(JSON.stringify({ success: false, error: "ID is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[menu-sync] ⚡ PATCH request for ${type}/${id}/${action || ""} (restaurant: ${restaurant.slug})`);

        try {
          let table = "";
          let restaurantField = "restaurant_id";
          let updateData = mapFields(body);

          if (type === "product" || type === "border" || type === "additional") table = "menu_items";
          else if (type === "category") table = "menu_categories";
          else if (type === "beverage") {
            table = "pizzeria_beverages";
            restaurantField = "pizzeria_id";
          } else if (type === "combo") table = "combos";
          else if (type === "delivery-zone") table = "delivery_zones";
          else {
            return new Response(JSON.stringify({ success: false, error: "Invalid type" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (action === "status") {
            updateData = { is_active: body.active ?? body.is_active };
          }

          const { data: result, error } = await (supabaseAdmin
            .from(table as any) as any)
            .update(updateData)
            .eq("id", id)
            .eq(restaurantField, restaurant.id)
            .select()
            .maybeSingle();

          if (error) throw error;
          if (!result) {
            return new Response(JSON.stringify({ success: false, error: "Record not found or unauthorized" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ success: true, data: result }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error(`[menu-sync] 💥 Error in PATCH ${type}/${id}:`, err);
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }
  }
});
