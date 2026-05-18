 import { supabaseAdmin } from "@/integrations/supabase/client.server";
 
 export async function validateApiKey(request: Request) {
   const apiKey = request.headers.get("x-api-key");
   
   if (!apiKey) {
     return { error: "x-api-key header is required", status: 401 };
   }
 
   const { data: restaurant, error } = await supabaseAdmin
     .from("restaurants")
     .select("id, slug, name, flycontrol_api_key")
     .eq("flycontrol_api_key", apiKey)
     .maybeSingle();
 
   if (error || !restaurant) {
     return { error: "Invalid API Key", status: 403 };
   }
 
   return { restaurant };
 }