 import { supabaseAdmin } from "@/integrations/supabase/client.server";
 
 export async function validateApiKey(request: Request) {
  const bearer = request.headers.get("authorization") || request.headers.get("Authorization");
  const bearerToken = bearer?.toLowerCase().startsWith("bearer ")
    ? bearer.slice(7).trim()
    : null;
  const apiKey =
    request.headers.get("x-api-key") ||
    request.headers.get("apikey") ||
    bearerToken;
   
   if (!apiKey) {
    return { error: "x-api-key, apikey, or Authorization Bearer header is required", status: 401 };
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