/**
 * Catálogo: regiões, categorias de veículo e tarifas.
 *
 * Tudo que aparece para o cliente escolher — e todo preço cobrado — sai
 * daqui. Mudar preço é mudar uma linha de tarifa no admin, não é mexer no
 * sistema.
 */

import { zcAdmin } from "../db/client";
import { ZcError, zcError } from "../errors";
import type {
  ZcItemPresetRow,
  ZcRegionRow,
  ZcTariffAddonRow,
  ZcTariffRow,
  ZcVehicleCategoryRow,
} from "../db/types";
import type { ZcCaller } from "../http/auth";
import type { TariffUpsertInput } from "../validation";
import { getSettings } from "./settings.service";
import { recordAudit } from "./audit.service";

export async function listRegions(includeInactive = false): Promise<ZcRegionRow[]> {
  let query = zcAdmin().from("zc_regions").select("*").is("deleted_at", null).order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getDefaultRegion(): Promise<ZcRegionRow | null> {
  const { data, error } = await zcAdmin()
    .from("zc_regions")
    .select("*")
    .eq("is_default", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRegion(regionId: string | null): Promise<ZcRegionRow | null> {
  if (!regionId) return getDefaultRegion();
  const { data, error } = await zcAdmin()
    .from("zc_regions")
    .select("*")
    .eq("id", regionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ?? (await getDefaultRegion());
}

export async function listVehicleCategories(
  includeInactive = false,
): Promise<ZcVehicleCategoryRow[]> {
  let query = zcAdmin()
    .from("zc_vehicle_categories")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getVehicleCategory(categoryId: string): Promise<ZcVehicleCategoryRow> {
  const { data, error } = await zcAdmin()
    .from("zc_vehicle_categories")
    .select("*")
    .eq("id", categoryId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw zcError.notFound("Categoria de veículo não encontrada.");
  return data;
}

/**
 * Acha a tarifa que vale agora para (região, categoria).
 * Se a região não tiver tarifa própria, cai na tarifa geral — como o
 * cardápio da rede valendo quando a loja não tem cardápio próprio.
 */
export async function resolveTariff(
  categoryId: string,
  regionId: string | null,
): Promise<ZcTariffRow> {
  const db = zcAdmin();
  if (regionId) {
    const { data, error } = await db
      .from("zc_tariffs")
      .select("*")
      .eq("category_id", categoryId)
      .eq("region_id", regionId)
      .eq("active", true)
      .is("valid_to", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const { data, error } = await db
    .from("zc_tariffs")
    .select("*")
    .eq("category_id", categoryId)
    .is("region_id", null)
    .eq("active", true)
    .is("valid_to", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new ZcError(
      "ZC_NO_TARIFF",
      "Ainda não há preço cadastrado para esta categoria de veículo. Cadastre a tarifa no painel.",
    );
  }
  return data;
}

export async function listTariffs(params: { regionId?: string | null; categoryId?: string } = {}) {
  let query = zcAdmin()
    .from("zc_tariffs")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (params.categoryId) query = query.eq("category_id", params.categoryId);
  if (params.regionId === null) query = query.is("region_id", null);
  else if (params.regionId) query = query.eq("region_id", params.regionId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Publica uma nova tarifa. A anterior não é apagada: ela é FECHADA com
 * data de fim. Assim toda corrida antiga continua explicável pelo preço
 * que valia no dia — como guardar o cardápio antigo para conferir uma
 * conta de mês passado.
 */
export async function publishTariff(
  caller: ZcCaller,
  input: TariffUpsertInput,
): Promise<ZcTariffRow> {
  const db = zcAdmin();
  const now = new Date().toISOString();

  let currentQuery = db
    .from("zc_tariffs")
    .select("*")
    .eq("category_id", input.category_id)
    .eq("active", true)
    .is("valid_to", null)
    .is("deleted_at", null);
  currentQuery = input.region_id
    ? currentQuery.eq("region_id", input.region_id)
    : currentQuery.is("region_id", null);

  const { data: current, error: currentError } = await currentQuery.maybeSingle();
  if (currentError) throw currentError;

  if (current) {
    const { error } = await db
      .from("zc_tariffs")
      .update({ valid_to: now, active: false })
      .eq("id", current.id);
    if (error) throw error;
  }

  const { data, error } = await db
    .from("zc_tariffs")
    .insert({
      ...input,
      region_id: input.region_id ?? null,
      valid_from: now,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;

  await recordAudit({
    caller,
    action: "tariff.publish",
    entityTable: "zc_tariffs",
    entityId: data.id,
    before: current,
    after: data,
  });
  return data;
}

export async function upsertRegion(
  caller: ZcCaller,
  input: Partial<ZcRegionRow> & { slug: string; name: string },
) {
  const { data, error } = await zcAdmin()
    .from("zc_regions")
    .upsert(input, { onConflict: "slug" })
    .select()
    .single();
  if (error) throw error;
  await recordAudit({
    caller,
    action: "region.upsert",
    entityTable: "zc_regions",
    entityId: data.id,
    after: data,
  });
  return data;
}

export async function upsertVehicleCategory(
  caller: ZcCaller,
  input: Partial<ZcVehicleCategoryRow> & { slug: string; name: string },
) {
  const { data, error } = await zcAdmin()
    .from("zc_vehicle_categories")
    .upsert(input, { onConflict: "slug" })
    .select()
    .single();
  if (error) throw error;
  await recordAudit({
    caller,
    action: "vehicle_category.upsert",
    entityTable: "zc_vehicle_categories",
    entityId: data.id,
    after: data,
  });
  return data;
}

/** O catálogo inteiro numa chamada só — é o que a tela de pedido precisa. */
export async function getPublicCatalog() {
  const [regions, categories, tariffs, addons, items, settings] = await Promise.all([
    listRegions(),
    listVehicleCategories(),
    listTariffs(),
    listAddons(),
    listItemPresets(),
    getSettings(),
  ]);

  return {
    regions,
    categories: categories.map((category) => ({
      ...category,
      max_volume_m3: category.max_volume_m3 === null ? null : Number(category.max_volume_m3),
    })),
    addons: addons.map((addon) => ({
      id: addon.id,
      code: addon.code,
      name: addon.name,
      description: addon.description,
      category_id: addon.category_id,
      region_id: addon.region_id,
      pricing_mode: addon.pricing_mode,
      amount_cents: addon.amount_cents,
      percent: Number(addon.percent),
      max_quantity: addon.max_quantity,
      requires_quantity: addon.requires_quantity,
      icon: addon.icon,
      sort_order: addon.sort_order,
    })),
    items,
    map: {
      tile_url: settings["map.tile_url"] ?? "",
      attribution: settings["map.attribution"] ?? "",
      default_center: settings["map.default_center"] ?? { lat: -23.5505, lng: -46.6333 },
    },
    order: {
      max_stops: Number(settings["order.max_stops"] ?? 6),
      min_lead_minutes: Number(settings["order.min_lead_minutes"] ?? 30),
      max_lead_days: Number(settings["order.max_lead_days"] ?? 30),
    },
    tariffs: tariffs
      .filter((tariff) => tariff.active && tariff.valid_to === null)
      .map((tariff) => ({
        id: tariff.id,
        region_id: tariff.region_id,
        category_id: tariff.category_id,
        currency: tariff.currency,
        base_fare_cents: tariff.base_fare_cents,
        included_km: Number(tariff.included_km),
        price_per_km_cents: tariff.price_per_km_cents,
        price_per_minute_cents: tariff.price_per_minute_cents,
        minimum_fare_cents: tariff.minimum_fare_cents,
        extra_stop_cents: tariff.extra_stop_cents,
        helper_cents: tariff.helper_cents,
        immediate_surcharge_pct: Number(tariff.immediate_surcharge_pct),
      })),
  };
}

// ---------------------------------------------------------------------
// FASE 3 — adicionais e catálogo de itens
// ---------------------------------------------------------------------

/**
 * Adicionais que valem para uma categoria numa região.
 * A regra de escolha é a mesma da tarifa: o mais específico ganha. Se
 * existe um "escada" próprio de São Paulo, ele substitui o geral — como o
 * cardápio da filial que sobrepõe o da rede.
 */
export async function listAddons(
  params: {
    categoryId?: string | null;
    regionId?: string | null;
    includeInactive?: boolean;
  } = {},
): Promise<ZcTariffAddonRow[]> {
  let query = zcAdmin()
    .from("zc_tariff_addons")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order");
  if (!params.includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw error;

  const all = data ?? [];
  if (params.includeInactive) return all;

  const applies = all.filter(
    (addon) =>
      (addon.category_id === null || addon.category_id === params.categoryId) &&
      (addon.region_id === null || addon.region_id === params.regionId),
  );

  // Fica um por código: o de escopo mais específico vence.
  const specificity = (addon: ZcTariffAddonRow) =>
    (addon.category_id ? 2 : 0) + (addon.region_id ? 1 : 0);
  const winners = new Map<string, ZcTariffAddonRow>();
  for (const addon of applies) {
    const current = winners.get(addon.code);
    if (!current || specificity(addon) > specificity(current)) winners.set(addon.code, addon);
  }
  return [...winners.values()].sort((a, b) => a.sort_order - b.sort_order);
}

export async function upsertAddon(
  caller: ZcCaller,
  input: Partial<ZcTariffAddonRow> & { code: string; name: string },
): Promise<ZcTariffAddonRow> {
  const db = zcAdmin();
  const { data, error } = input.id
    ? await db.from("zc_tariff_addons").update(input).eq("id", input.id).select().single()
    : await db.from("zc_tariff_addons").insert(input).select().single();
  if (error) throw error;

  await recordAudit({
    caller,
    action: "addon.upsert",
    entityTable: "zc_tariff_addons",
    entityId: data.id,
    after: data,
  });
  return data;
}

export async function listItemPresets(includeInactive = false): Promise<ZcItemPresetRow[]> {
  let query = zcAdmin()
    .from("zc_item_presets")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
