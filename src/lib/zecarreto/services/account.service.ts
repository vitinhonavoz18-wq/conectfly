/**
 * Conta do usuário: perfil, foto, endereços favoritos e aceite dos termos.
 *
 * Vale para os três perfis (cliente, motorista e admin) — todo mundo tem
 * um cadastro básico. O que muda é o que cada um faz depois.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError } from "../errors";
import type { ZcRole } from "../domain/enums";
import { clientChecklist } from "../domain/onboarding";
import { maskProfile } from "../domain/masking";
import type { ZcAddressRow, ZcProfileRow, ZcTermsAcceptanceRow } from "../db/types";
import type { ZcCaller } from "../http/auth";
import { getSetting } from "./settings.service";
import { recordAudit } from "./audit.service";

export interface ProfileInput {
  full_name?: string;
  phone?: string;
  email?: string;
  document_number?: string;
  birth_date?: string;
  avatar_url?: string | null;
}

/** Cria o cadastro na primeira vez que a pessoa entra. */
export async function ensureProfile(
  userId: string,
  seed: { full_name?: string; email?: string; phone?: string } = {},
): Promise<ZcProfileRow> {
  const db = zcAdmin();
  const { data: existing } = await db
    .from("zc_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await db
    .from("zc_profiles")
    .insert({
      id: userId,
      full_name: seed.full_name?.trim() || "Novo usuário",
      email: seed.email ?? null,
      phone: seed.phone ?? null,
    })
    .select()
    .single();
  if (error) throw fromPostgresError(error);
  return data;
}

export async function getProfile(profileId: string): Promise<ZcProfileRow | null> {
  const { data, error } = await zcAdmin()
    .from("zc_profiles")
    .select("*")
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  return data;
}

export async function updateProfile(caller: ZcCaller, input: ProfileInput): Promise<ZcProfileRow> {
  const db = zcAdmin();
  await ensureProfile(caller.profileId);

  const patch: Partial<ZcProfileRow> = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name.trim();
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.document_number !== undefined) patch.document_number = input.document_number;
  if (input.birth_date !== undefined) patch.birth_date = input.birth_date;
  if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url;

  const { data, error } = await db
    .from("zc_profiles")
    .update(patch)
    .eq("id", caller.profileId)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      throw zcError.conflict(
        "Este CPF ou telefone já está cadastrado em outra conta. Se for seu, recupere o acesso.",
      );
    }
    throw fromPostgresError(error);
  }
  if (!data) throw zcError.notFound("Cadastro não encontrado.");
  return data;
}

/** Retrato completo da conta — é o que a tela do cliente carrega de uma vez. */
export async function getAccountSnapshot(caller: ZcCaller) {
  const db = zcAdmin();
  const profile = (await getProfile(caller.profileId)) ?? (await ensureProfile(caller.profileId));

  const [addresses, terms, clientVersion] = await Promise.all([
    listAddresses(caller.profileId),
    listTermsAcceptances(caller.profileId),
    getSetting<string>("terms.client_version", "1"),
  ]);

  const acceptedTerms = terms.some(
    (item) => item.audience === "client" && item.terms_version === clientVersion,
  );

  return {
    profile,
    roles: caller.roles,
    addresses,
    terms: { current_version: clientVersion, accepted: acceptedTerms, history: terms },
    checklist: clientChecklist({ profile, acceptedTerms }),
  };
}

// ---------------------------------------------------------------------
// Endereços favoritos
// ---------------------------------------------------------------------

export async function listAddresses(profileId: string): Promise<ZcAddressRow[]> {
  const { data, error } = await zcAdmin()
    .from("zc_addresses")
    .select("*")
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

export async function createAddress(
  caller: ZcCaller,
  input: Partial<ZcAddressRow> & { street: string; city: string; state: string },
): Promise<ZcAddressRow> {
  const db = zcAdmin();
  // "Endereço padrão" é um só: marcar um novo desmarca o anterior.
  if (input.is_default) await clearDefaultAddress(caller.profileId);

  const { data, error } = await db
    .from("zc_addresses")
    .insert({ ...input, profile_id: caller.profileId })
    .select()
    .single();
  if (error) throw fromPostgresError(error);
  return data;
}

export async function updateAddress(
  caller: ZcCaller,
  addressId: string,
  input: Partial<ZcAddressRow>,
): Promise<ZcAddressRow> {
  const db = zcAdmin();
  await assertOwnsAddress(caller, addressId);
  if (input.is_default) await clearDefaultAddress(caller.profileId, addressId);

  const { profile_id: _ignored, ...patch } = input;
  const { data, error } = await db
    .from("zc_addresses")
    .update(patch)
    .eq("id", addressId)
    .select()
    .maybeSingle();
  if (error) throw fromPostgresError(error);
  if (!data) throw zcError.notFound("Endereço não encontrado.");
  return data;
}

/** Some da lista, mas continua guardado para as corridas antigas. */
export async function deleteAddress(caller: ZcCaller, addressId: string): Promise<void> {
  await assertOwnsAddress(caller, addressId);
  const { error } = await zcAdmin()
    .from("zc_addresses")
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq("id", addressId);
  if (error) throw fromPostgresError(error);
}

async function assertOwnsAddress(caller: ZcCaller, addressId: string): Promise<void> {
  const { data } = await zcAdmin()
    .from("zc_addresses")
    .select("profile_id")
    .eq("id", addressId)
    .maybeSingle();
  if (!data) throw zcError.notFound("Endereço não encontrado.");
  if (data.profile_id !== caller.profileId && !caller.isAdmin) {
    throw zcError.forbidden("Este endereço não é seu.");
  }
}

async function clearDefaultAddress(profileId: string, exceptId?: string): Promise<void> {
  let query = zcAdmin()
    .from("zc_addresses")
    .update({ is_default: false })
    .eq("profile_id", profileId)
    .eq("is_default", true);
  if (exceptId) query = query.neq("id", exceptId);
  await query;
}

// ---------------------------------------------------------------------
// Termos de uso
// ---------------------------------------------------------------------

export async function listTermsAcceptances(profileId: string): Promise<ZcTermsAcceptanceRow[]> {
  const { data, error } = await zcAdmin()
    .from("zc_terms_acceptances")
    .select("*")
    .eq("profile_id", profileId)
    .order("accepted_at", { ascending: false });
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

export async function currentTermsVersion(audience: ZcRole): Promise<string> {
  const key = audience === "driver" ? "terms.driver_version" : "terms.client_version";
  return getSetting<string>(key, "1");
}

export async function hasAcceptedCurrentTerms(
  profileId: string,
  audience: ZcRole,
): Promise<boolean> {
  const version = await currentTermsVersion(audience);
  const { data } = await zcAdmin()
    .from("zc_terms_acceptances")
    .select("id")
    .eq("profile_id", profileId)
    .eq("audience", audience)
    .eq("terms_version", version)
    .maybeSingle();
  return !!data;
}

/**
 * Registra o aceite. Guarda a versão, a data, o endereço de rede e o
 * aparelho — se um dia houver discussão, existe o comprovante.
 */
export async function acceptTerms(
  caller: ZcCaller,
  audience: ZcRole,
  version?: string,
): Promise<ZcTermsAcceptanceRow> {
  const currentVersion = await currentTermsVersion(audience);
  if (version && version !== currentVersion) {
    throw zcError.conflict(
      "Os termos foram atualizados. Recarregue a página e leia a nova versão.",
    );
  }

  const { data, error } = await zcAdmin()
    .from("zc_terms_acceptances")
    .upsert(
      {
        profile_id: caller.profileId,
        audience,
        terms_version: currentVersion,
        ip: caller.ip,
        user_agent: caller.userAgent,
      },
      { onConflict: "profile_id,audience,terms_version" },
    )
    .select()
    .single();
  if (error) throw fromPostgresError(error);

  await recordAudit({
    caller,
    action: "terms.accept",
    entityTable: "zc_terms_acceptances",
    entityId: data.id,
    after: { audience, version: currentVersion },
  });
  return data;
}

/** Versão do perfil para quem NÃO é o dono (listagens do admin). */
export function publicProfileView(profile: ZcProfileRow) {
  return maskProfile(profile);
}
