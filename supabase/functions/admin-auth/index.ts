import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().split('-')[0]
  console.log(`[${requestId}] Login iniciado`)

  try {
    const body = await req.json()
    const { password } = body
    
    console.log(`[${requestId}] Body recebido:`, JSON.stringify({ ...body, password: '***' }))

    const ADMIN_PASS = Deno.env.get('ADMIN_PASSWORD')
    const ADMIN_EMAIL = 'vitinhonavoz18@gmail.com'

    if (!ADMIN_PASS) {
      console.error(`[${requestId}] Erro: ADMIN_PASSWORD não configurada nos Secrets`)
      throw new Error('ADMIN_PASSWORD environment variable not set')
    }

    if (!password) {
      console.warn(`[${requestId}] Tentativa de login sem senha`)
      return new Response(JSON.stringify({ error: 'Senha é obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validação da senha
    console.log(`[${requestId}] Executando validação de senha`)
    if (password !== ADMIN_PASS) {
      console.warn(`[${requestId}] Senha incorreta fornecida`)
      return new Response(JSON.stringify({ 
        success: false, 
        authenticated: false, 
        error: 'Senha administrativa inválida.' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Reset the admin user's password to the shared admin password to ensure we can log in
    // Hardcoded ID for the specific admin vitinhonavoz18@gmail.com
    const adminId = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3'
    
    console.log(`[${requestId}] Sincronizando senha do admin no Auth (ID: ${adminId})`)
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      adminId,
      { password: ADMIN_PASS }
    )

    if (updateError) {
      console.error(`[${requestId}] Erro ao atualizar usuário admin:`, updateError.message)
      throw updateError
    }

    // Now sign in the user to get a real session
    console.log(`[${requestId}] Autenticando usuário no Supabase Auth`)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
    })

    if (authError) {
      console.error(`[${requestId}] Erro na autenticação final:`, authError.message)
      throw authError
    }

    console.log(`[${requestId}] Sucesso! Login autorizado para ${ADMIN_EMAIL}`)

    return new Response(JSON.stringify({ 
      success: true,
      authenticated: true,
      session: authData.session,
      user: authData.user 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error(`[${requestId}] Erro detalhado:`, error.message)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
