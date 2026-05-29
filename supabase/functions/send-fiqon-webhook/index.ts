import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { webhookUrl, payload, restaurantId } = await req.json()

    if (!webhookUrl) {
      console.error("Missing webhookUrl")
      return new Response(
        JSON.stringify({ error: "Missing webhookUrl" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // MANDATORY LOGS
    console.log("URL FIQON FINAL:", webhookUrl)
    console.log("PAYLOAD ENVIADO:", JSON.stringify(payload))

    let responseStatus = 0
    let responseBody = ""
    let errorMsg = null

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      responseStatus = response.status
      responseBody = await response.text()
      
      console.log("STATUS REAL FIQON:", responseStatus)
      console.log("BODY REAL FIQON:", responseBody)

      let parsedBody
      try {
        parsedBody = JSON.parse(responseBody)
      } catch {
        parsedBody = { raw: responseBody }
      }

      // Log to database
      await supabase.from("order_submission_logs").insert({
        restaurant_id: restaurantId,
        order_id: payload.order?.id || "test",
        source: restaurantId ? "admin_test" : "unknown",
        webhook_url: webhookUrl,
        payload: payload,
        status: responseStatus,
        response: parsedBody,
        error: response.ok ? null : `Status ${responseStatus}`
      })

      return new Response(
        JSON.stringify({
          success: response.ok,
          status: responseStatus,
          response: parsedBody,
          url: webhookUrl
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (fetchError: any) {
      errorMsg = fetchError.message
      console.error("ERRO AO CHAMAR FIQON:", errorMsg)

      // Log error to database
      await supabase.from("order_submission_logs").insert({
        restaurant_id: restaurantId,
        order_id: payload.order?.id || "test",
        source: restaurantId ? "admin_test" : "unknown",
        webhook_url: webhookUrl,
        payload: payload,
        status: 0,
        error: errorMsg
      })

      return new Response(
        JSON.stringify({
          success: false,
          status: 0,
          error: errorMsg,
          url: webhookUrl
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (err: any) {
    console.error("Internal server error:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
