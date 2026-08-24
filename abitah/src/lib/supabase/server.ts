import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, getServiceRoleKey, isSupabaseConfigured } from "./env";

/**
 * Cliente para Server Components / Route Handlers, com sessão do usuário.
 * Retorna null em modo demonstração.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Chamado a partir de um Server Component: a renovação de sessão
          // acontece no middleware, então este erro pode ser ignorado.
        }
      },
    },
  });
}

/**
 * Cliente administrativo (service role). NUNCA use em código de cliente.
 * Retorna null se a chave de serviço não estiver configurada.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const serviceKey = getServiceRoleKey();
  if (!isSupabaseConfigured() || !serviceKey) return null;
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
