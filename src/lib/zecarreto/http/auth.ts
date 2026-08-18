/**
 * Quem está batendo na porta.
 *
 * Descobre o usuário a partir do token, carrega o perfil e os papéis, e
 * entrega isso pronto para o endpoint. É o porteiro conferindo o crachá
 * antes de qualquer coisa acontecer.
 */

import { createClient } from "@supabase/supabase-js";
import { zcAdmin } from "../db/client";
import { zcError } from "../errors";
import type { ZcRole } from "../domain/enums";
import type { ZcProfileRow } from "../db/types";

export interface ZcCaller {
  profileId: string;
  profile: ZcProfileRow | null;
  roles: ZcRole[];
  isAdmin: boolean;
  isDriver: boolean;
  isClient: boolean;
  driverId: string | null;
  customerId: string | null;
  accessToken: string;
  ip: string | null;
  userAgent: string | null;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function clientIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

async function verifyToken(token: string): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw zcError.internal("Autenticação não está configurada no servidor.");
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) {
    throw zcError.unauthenticated("Sua sessão expirou. Entre de novo.");
  }
  return userId as string;
}

/** Exige usuário logado e devolve tudo o que se sabe sobre ele. */
export async function resolveCaller(request: Request): Promise<ZcCaller> {
  const token = bearerToken(request);
  if (!token) {
    throw zcError.unauthenticated();
  }
  const userId = await verifyToken(token);
  const db = zcAdmin();

  const [profileResult, rolesResult, driverResult, customerResult] = await Promise.all([
    db.from("zc_profiles").select("*").eq("id", userId).is("deleted_at", null).maybeSingle(),
    db.from("zc_user_roles").select("role").eq("user_id", userId),
    db
      .from("zc_drivers")
      .select("id")
      .eq("profile_id", userId)
      .is("deleted_at", null)
      .maybeSingle(),
    db
      .from("zc_customers")
      .select("id")
      .eq("profile_id", userId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const roles = (rolesResult.data ?? []).map((row) => row.role as ZcRole);
  const profile = profileResult.data ?? null;

  if (profile && profile.status === "banned") {
    throw zcError.forbidden("Esta conta está bloqueada. Fale com o suporte.");
  }

  return {
    profileId: userId,
    profile,
    roles,
    isAdmin: roles.includes("admin"),
    isDriver: roles.includes("driver"),
    isClient: roles.includes("client"),
    driverId: driverResult.data?.id ?? null,
    customerId: customerResult.data?.id ?? null,
    accessToken: token,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  };
}

/** Exige um dos papéis informados. Admin passa em tudo. */
export function requireRole(caller: ZcCaller, ...roles: ZcRole[]): ZcCaller {
  if (caller.isAdmin) return caller;
  if (!roles.some((role) => caller.roles.includes(role))) {
    throw zcError.forbidden("Esta área não é do seu perfil.");
  }
  return caller;
}

export function requireAdmin(caller: ZcCaller): ZcCaller {
  if (!caller.isAdmin) {
    throw zcError.forbidden("Somente o administrador pode fazer isso.");
  }
  return caller;
}

/** Exige motorista com cadastro aprovado. */
export async function requireApprovedDriver(caller: ZcCaller): Promise<string> {
  if (caller.isAdmin && !caller.driverId) {
    throw zcError.forbidden("Esta ação precisa de um cadastro de motorista.");
  }
  if (!caller.driverId) {
    throw zcError.forbidden("Você ainda não tem cadastro de motorista.");
  }
  const { data } = await zcAdmin()
    .from("zc_drivers")
    .select("status")
    .eq("id", caller.driverId)
    .maybeSingle();
  if (!data) throw zcError.notFound("Cadastro de motorista não encontrado.");
  if (data.status !== "approved") {
    throw zcError.forbidden(
      "Seu cadastro ainda não foi aprovado. Envie os documentos e aguarde a análise.",
    );
  }
  return caller.driverId;
}

/** O papel "principal" de quem está agindo — usado no histórico da corrida. */
export function primaryRole(caller: ZcCaller): ZcRole {
  if (caller.isAdmin) return "admin";
  if (caller.isDriver) return "driver";
  return "client";
}
