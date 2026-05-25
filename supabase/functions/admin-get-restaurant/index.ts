import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
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
      console.error(`[${requestId}] Erro de autenticação:`, userError?.message)
      return new Response(JSON.stringify({ error: `Unauthorized: ${userError?.message || 'No user'}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ADMIN_EMAIL = 'vitinhonavoz18@gmail.com'
    if (user.email !== ADMIN_EMAIL) {
      console.warn(`[${requestId}] Acesso negado para o email: ${user.email}`)
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Parse body for POST/PUT requests
    let body: any = {}
    if (method === 'POST' || method === 'PUT') {
      try {
        body = await req.json()
      } catch (e) {
        console.warn(`[${requestId}] Falha ao parsear JSON do body`)
      }
    }

    const url = new URL(req.url)
    const id = body?.id || url.searchParams.get('id')
    const action = body?.action || url.searchParams.get('action') || 'get'
    const includeFullData = body?.full === true || url.searchParams.get('full') === 'true'

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    console.log(`[${requestId}] Action: ${action} | Target ${isUuid ? 'ID' : 'SLUG'}: ${id} | Full: ${includeFullData}`)

    if (action === 'get') {
      const query = supabaseAdmin.from('restaurants').select('*')
      if (isUuid) {
        query.eq('id', id)
      } else {
        query.eq('slug', id)
      }

      const { data: restaurant, error } = await query.maybeSingle()

      if (error) {
        console.error(`[${requestId}] Erro na query de restaurante:`, error.message)
        throw error
      }
      
      if (!restaurant) {
        console.warn(`[${requestId}] Restaurante não encontrado: ${id}`)
        return new Response(JSON.stringify({ error: 'Restaurante não encontrado' }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      let responseData: any = { restaurant }

      if (includeFullData) {
        console.log(`[${requestId}] Buscando dados completos (cardápio, combos, etc)`)
        const [cats, items, groups, combos, zones, beverages, sizes] = await Promise.all([
          supabaseAdmin.from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
          supabaseAdmin.from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
          supabaseAdmin.from('combo_groups').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
          supabaseAdmin.from('combos').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
          supabaseAdmin.from('delivery_zones').select('*').eq('restaurant_id', restaurant.id).order('sort_order'),
          supabaseAdmin.from('pizzeria_beverages').select('*').eq('pizzeria_id', restaurant.id).order('sort_order'),
          supabaseAdmin.from('pizzeria_pizza_sizes').select('*').eq('pizzeria_id', restaurant.id).order('sort_order'),
        ])

        responseData = {
          ...responseData,
          categories: cats.data || [],
          items: items.data || [],
          comboGroups: groups.data || [],
          combos: combos.data || [],
          deliveryZones: zones.data || [],
          beverages: beverages.data || [],
          pizzaSizes: sizes.data || [],
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        data: includeFullData ? responseData : restaurant
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update') {
      const { updates } = body
      if (!updates) {
        return new Response(JSON.stringify({ error: 'Updates are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`[${requestId}] Executando update para restaurante: ${id}`)
      const { data, error } = await supabaseAdmin
        .from('restaurants')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error(`[${requestId}] Erro no update:`, error.message)
        throw error
      }

      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed or invalid action' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error(`[${requestId}] Erro Fatal:`, error.message)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: error.status || 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
