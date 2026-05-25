import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().split('-')[0]
  const method = req.method
  console.log(`[${requestId}] Admin Restaurant Handler (${method}) iniciado`)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${userError?.message || 'No user'}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ADMIN_EMAIL = 'vitinhonavoz18@gmail.com'
    if (user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    if (method === 'GET' || (method === 'POST' && req.headers.get('Content-Type') === 'application/json')) {
      const body = method === 'POST' ? await req.json() : null
      const url = new URL(req.url)
      const id = body?.id || url.searchParams.get('id')
      const action = body?.action || 'get'

      if (!id) {
        return new Response(JSON.stringify({ error: 'ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      console.log(`[${requestId}] Action: ${action} | Target ${isUuid ? 'ID' : 'SLUG'}: ${id}`)

      if (action === 'get') {
        const query = supabaseAdmin.from('restaurants').select('*')
        if (isUuid) query.eq('id', id)
        else query.eq('slug', id)

        const { data, error } = await query.maybeSingle()

        if (error) throw error
        if (!data) return new Response(JSON.stringify({ error: 'Restaurante não encontrado' }), { status: 404, headers: corsHeaders })

        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (action === 'update') {
        const { updates } = body
        if (!updates) throw new Error('Updates are required')

        const { data, error } = await supabaseAdmin
          .from('restaurants')
          .update(updates)
          .eq('id', id) // Always use ID for updates for safety
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error(`[${requestId}] Erro:`, error.message)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: error.status || 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
