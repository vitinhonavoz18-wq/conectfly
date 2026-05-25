import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { password } = await req.json()
    const ADMIN_PASS = Deno.env.get('ADMIN_PASSWORD')
    const ADMIN_EMAIL = 'vitinhonavoz18@gmail.com'

    if (!ADMIN_PASS) {
      throw new Error('ADMIN_PASSWORD environment variable not set')
    }

    if (password !== ADMIN_PASS) {
      return new Response(JSON.stringify({ error: 'Senha administrativa inválida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Reset the admin user's password to the shared admin password to ensure we can log in
    // This is safe because only this function (with ADMIN_PASSWORD) can trigger this.
    const { data: userUpdate, error: updateError } = await supabase.auth.admin.updateUserById(
      'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3',
      { password: ADMIN_PASS }
    )

    if (updateError) {
      throw updateError
    }

    // Now sign in the user to get a real session
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
    })

    if (authError) {
      throw authError
    }

    return new Response(JSON.stringify({ 
      session: authData.session,
      user: authData.user 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Admin Auth Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
