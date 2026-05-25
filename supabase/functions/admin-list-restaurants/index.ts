import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().split('-')[0]
  console.log(`[${requestId}] Admin List Restaurants iniciado`)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn(`[${requestId}] Cabeçalho Authorization ausente`)
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

    console.log(`[${requestId}] Validando token do usuário...`)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error(`[${requestId}] Erro ao validar usuário:`, userError?.message)
      return new Response(JSON.stringify({ error: `Unauthorized: ${userError?.message || 'No user'}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${requestId}] Usuário validado: ${user.email}`)

    const ADMIN_EMAIL = 'vitinhonavoz18@gmail.com'
    if (user.email !== ADMIN_EMAIL) {
      console.warn(`[${requestId}] Acesso negado para: ${user.email}`)
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`[${requestId}] Buscando todos os restaurantes...`)
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(`[${requestId}] Erro na query do banco:`, error.message)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${requestId}] Sucesso! Retornando ${data.length} registros.`)

    return new Response(JSON.stringify({ 
      success: true,
      data
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error(`[${requestId}] Erro inesperado:`, error.message)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
