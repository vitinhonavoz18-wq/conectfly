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
    
    const ADMIN_PASS = Deno.env.get('ADMIN_PASSWORD')
    const ADMIN_EMAIL = 'vitinhonavoz18@gmail.com'

    if (!ADMIN_PASS) {
      console.error(`[${requestId}] Erro: ADMIN_PASSWORD não configurada nos Secrets`)
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Configuração do servidor incompleta" 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!password) {
      console.warn(`[${requestId}] Tentativa de login sem senha`)
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Senha é obrigatória" 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validação da senha
    if (password !== ADMIN_PASS) {
      console.warn(`[${requestId}] Senha incorreta fornecida`)
      return new Response(JSON.stringify({ 
        success: false, 
        authenticated: false, 
        message: "Senha incorreta" 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Ensure the admin user exists and has the correct password
    const adminId = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3'
    
    console.log(`[${requestId}] Sincronizando senha do admin no Auth`)
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      adminId,
      { password: ADMIN_PASS }
    )

    if (updateError) {
      console.error(`[${requestId}] Erro ao sincronizar senha:`, updateError.message)
      // We continue because maybe the password is already correct and the error is just policy-related
    }

    // Now sign in the user to get a real session
    console.log(`[${requestId}] Autenticando no Supabase Auth`)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
    })

    if (authError) {
      console.error(`[${requestId}] Erro na autenticação final:`, authError.message)
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Falha na autenticação administrativa" 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${requestId}] Sucesso! Login autorizado`)

    return new Response(JSON.stringify({ 
      success: true,
      authenticated: true,
      session: authData.session
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error(`[${requestId}] Erro crítico:`, error.message)
    return new Response(JSON.stringify({ 
      success: false,
      message: "Ocorreu um erro interno ao processar o login" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})