/**
 * Acesso ao banco do ZÉ CARRETO.
 *
 * Duas portas de entrada, com finalidades bem diferentes:
 *
 * - `zcAdmin()` usa a chave de serviço e IGNORA as travas de RLS. É o
 *   gerente com a chave mestra: só pode ser usada dentro do servidor,
 *   nunca em código que chega ao navegador.
 * - `zcAsUser(token)` age em nome do usuário logado e respeita todas as
 *   travas. É o crachá de visitante: abre só as portas daquela pessoa.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ZecarretoDatabase } from "./types";

export type ZcClient = SupabaseClient<ZecarretoDatabase, "public">;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Veja o .env.example do projeto.`,
    );
  }
  return value;
}

let cachedAdmin: ZcClient | undefined;

/** Cliente com chave de serviço. SOMENTE no servidor. */
export function zcAdmin(): ZcClient {
  if (!cachedAdmin) {
    cachedAdmin = createClient<ZecarretoDatabase, "public">(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cachedAdmin;
}

/** Cliente em nome do usuário logado — sujeito a todas as regras de RLS. */
export function zcAsUser(accessToken: string): ZcClient {
  return createClient<ZecarretoDatabase, "public">(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Usado nos testes para trocar o banco por um dublê. */
export function __setZcAdminForTests(client: ZcClient | undefined) {
  cachedAdmin = client;
}
