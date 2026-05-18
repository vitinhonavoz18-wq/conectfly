 import { createFileRoute } from "@tanstack/react-router";
 import { supabaseAdmin } from "@/integrations/supabase/client.server";
 import { validateApiKey } from "@/lib/api-auth";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "content-type, x-api-key, authorization",
   "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
 };
 
 export const Route = createFileRoute("/api/menu-sync/$")({
   server: {
     handlers: {
       OPTIONS: async () => new Response(null, { headers: corsHeaders }),
       
        POST: async ({ request, params }: { request: Request; params: any }) => {
          const auth = await validateApiKey(request);
          if (auth.error || !auth.restaurant) {
            return new Response(JSON.stringify({ success: false, error: auth.error || "Unauthorized" }), {
              status: auth.status || 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const restaurant = auth.restaurant;
          const path = params._splat || ""; // e.g. "product" or "beverage"
          const body = await request.json();

          console.log(`[menu-sync] 🆕 POST request for ${path} (restaurant: ${restaurant.slug})`);
 
         try {
           let table = "";
           let data: any = { ...body, restaurant_id: restaurant.id };
 
           if (path === "product") {
             table = "menu_items";
           } else if (path === "category") {
             table = "menu_categories";
           } else if (path === "beverage") {
             table = "pizzeria_beverages";
             data = { ...body, pizzeria_id: restaurant.id };
             delete data.restaurant_id;
           } else if (path === "combo") {
             table = "combos";
           } else if (path === "border" || path === "additional") {
             // In this system, borders and additionals are items in specific categories
             // We need to ensure they are created in the right category
             table = "menu_items";
           } else {
             return new Response(JSON.stringify({ success: false, error: "Invalid path" }), {
               status: 400,
               headers: { ...corsHeaders, "Content-Type": "application/json" },
             });
           }
 
          const { data: result, error } = await (supabaseAdmin
            .from(table as any) as any)
             .insert(data)
             .select()
             .single();
 
           if (error) throw error;
 
           return new Response(JSON.stringify({ success: true, data: result }), {
             status: 201,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
           });
         } catch (err: any) {
           return new Response(JSON.stringify({ success: false, error: err.message }), {
             status: 500,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
           });
         }
       },
 
        PUT: async ({ request, params }: { request: Request; params: any }) => {
          const auth = await validateApiKey(request);
          if (auth.error || !auth.restaurant) {
            return new Response(JSON.stringify({ success: false, error: auth.error || "Unauthorized" }), {
              status: auth.status || 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const restaurant = auth.restaurant;
          const splat = (params._splat || "").split("/"); // e.g. ["product", "uuid"]
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
           let idField = "id";
           let restaurantField = "restaurant_id";
 
           if (type === "product") table = "menu_items";
           else if (type === "category") table = "menu_categories";
           else if (type === "beverage") {
             table = "pizzeria_beverages";
             restaurantField = "pizzeria_id";
           }
           else if (type === "combo") table = "combos";
           else if (type === "border" || type === "additional") table = "menu_items";
           else {
             return new Response(JSON.stringify({ success: false, error: "Invalid type" }), {
               status: 400,
               headers: { ...corsHeaders, "Content-Type": "application/json" },
             });
           }
 
          const { data: result, error } = await (supabaseAdmin
            .from(table as any) as any)
             .update(body)
             .eq(idField, id)
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
           return new Response(JSON.stringify({ success: false, error: err.message }), {
             status: 500,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
           });
         }
       },
 
        PATCH: async ({ request, params }: { request: Request; params: any }) => {
          const auth = await validateApiKey(request);
          if (auth.error || !auth.restaurant) {
            return new Response(JSON.stringify({ success: false, error: auth.error || "Unauthorized" }), {
              status: auth.status || 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const restaurant = auth.restaurant;
          const splat = (params._splat || "").split("/"); // e.g. ["product", "uuid", "status"]
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
           let updateData = body;
 
           if (type === "product") table = "menu_items";
           else if (type === "category") table = "menu_categories";
           else if (type === "beverage") {
             table = "pizzeria_beverages";
             restaurantField = "pizzeria_id";
           }
           else if (type === "combo") table = "combos";
           else if (type === "border" || type === "additional") table = "menu_items";
           else {
             return new Response(JSON.stringify({ success: false, error: "Invalid type" }), {
               status: 400,
               headers: { ...corsHeaders, "Content-Type": "application/json" },
             });
           }
 
           // Special handling for /status path
           if (action === "status") {
             // In our schema, status is usually 'is_active'
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
           return new Response(JSON.stringify({ success: false, error: err.message }), {
             status: 500,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
           });
         }
       }
     }
   }
 });