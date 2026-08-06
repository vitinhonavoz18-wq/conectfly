/**
 * Detecção do modo de operação.
 *
 * - Com as variáveis do Supabase preenchidas → modo REAL (banco + auth + storage).
 * - Sem elas → modo DEMONSTRAÇÃO, com catálogo local. O site continua 100%
 *   navegável, sem quebrar nenhuma página.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
}

/** Somente no servidor: chave de serviço para operações administrativas. */
export function getServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return key && key.length > 20 ? key : null;
}
