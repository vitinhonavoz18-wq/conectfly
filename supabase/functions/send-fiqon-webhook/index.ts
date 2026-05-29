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

  try {
    const { webhookUrl, payload } = await req.json()

    if (!webhookUrl) {
      console.error("Missing webhookUrl")
      return new Response(
        JSON.stringify({ error: "Missing webhookUrl" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[FIQON] Sending payload to: ${webhookUrl}`)
    console.log(`[FIQON] Payload:`, JSON.stringify(payload))

    const startTime = Date.now()
    
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const endTime = Date.now()
      const duration = endTime - startTime
      const status = response.status
      const responseText = await response.text()
      
      let responseBody
      try {
        responseBody = JSON.parse(responseText)
      } catch {
        responseBody = responseText
      }

      console.log(`[FIQON] Received status: ${status} in ${duration}ms`)
      console.log(`[FIQON] Response:`, responseText)

      return new Response(
        JSON.stringify({
          success: response.ok,
          status,
          response: responseBody,
          duration,
          url: webhookUrl
        }),
        { 
          status: 200, // Return 200 to our client so it can read the actual FIQON status
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (fetchError: any) {
      console.error(`[FIQON] Fetch error:`, fetchError.message)
      return new Response(
        JSON.stringify({
          success: false,
          status: 0,
          error: fetchError.message,
          url: webhookUrl
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (err: any) {
    console.error(`[FIQON] Internal error:`, err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
