/**
 * Configurações da plataforma.
 *
 * Toda regra que o dono pode querer mudar amanhã (tempo da oferta, raio de
 * busca, dia do repasse...) mora no banco, não no código. Aqui a gente só
 * lê e escreve, com um valor de reserva caso a chave ainda não exista.
 */

import { zcAdmin } from "../db/client";
import type { Json } from "../db/types";
import type { ZcCaller } from "../http/auth";
import { recordAudit } from "./audit.service";

export const ZC_SETTING_DEFAULTS = {
  "platform.currency": "BRL",
  "pricing.quote_ttl_seconds": 900,
  "pricing.immediate_surcharge_pct": 35,
  "pricing.rounding_cents": 0,
  "dispatch.offer_ttl_seconds": 45,
  "dispatch.batch_size": 5,
  "dispatch.max_rounds": 4,
  "dispatch.radius_initial_km": 5,
  "dispatch.radius_step_km": 5,
  "dispatch.radius_max_km": 25,
  "dispatch.scheduled_lead_minutes": 60,
  "tracking.min_seconds_between_pings": 10,
  "tracking.stale_after_seconds": 120,
  "wallet.hold_days": 7,
  "payout.close_weekday": 1,
  "payout.pay_weekday": 3,
  "payout.minimum_cents": 2000,
  "cancellation.free_seconds": 300,
  "support.default_priority": "normal",
  "driver.min_rating": 4.2,
} as const;

export type ZcSettingKey = keyof typeof ZC_SETTING_DEFAULTS;

let cache: { at: number; values: Record<string, unknown> } | null = null;
const CACHE_TTL_MS = 30_000;

export function clearSettingsCache() {
  cache = null;
}

/** Lê todas as configurações (com cache curto, para não pesar o banco). */
export async function getSettings(): Promise<Record<string, unknown>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.values;

  const { data, error } = await zcAdmin().from("zc_settings").select("key, value");
  if (error) throw error;

  const values: Record<string, unknown> = { ...ZC_SETTING_DEFAULTS };
  for (const row of data ?? []) values[row.key] = row.value;
  cache = { at: Date.now(), values };
  return values;
}

export async function getSetting<T>(key: ZcSettingKey | string, fallback?: T): Promise<T> {
  const settings = await getSettings();
  const value = settings[key];
  if (value === undefined || value === null) {
    return (fallback ?? (ZC_SETTING_DEFAULTS as Record<string, unknown>)[key]) as T;
  }
  return value as T;
}

export async function getNumberSetting(key: ZcSettingKey | string): Promise<number> {
  const value = await getSetting<number | string>(key);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function setSetting(
  caller: ZcCaller,
  key: string,
  value: unknown,
  description?: string,
) {
  const previous = await zcAdmin().from("zc_settings").select("*").eq("key", key).maybeSingle();

  const { data, error } = await zcAdmin()
    .from("zc_settings")
    .upsert(
      {
        key,
        value: value as Json,
        description: description ?? previous.data?.description ?? null,
        updated_by: caller.profileId,
      },
      { onConflict: "key" },
    )
    .select()
    .single();
  if (error) throw error;

  clearSettingsCache();
  await recordAudit({
    caller,
    action: "settings.update",
    entityTable: "zc_settings",
    entityId: key,
    before: previous.data,
    after: data,
  });
  return data;
}
