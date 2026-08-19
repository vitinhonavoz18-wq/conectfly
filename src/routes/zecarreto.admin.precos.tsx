import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, Tag } from "lucide-react";
import { toast } from "sonner";
import { ZcShell } from "@/components/zecarreto/ZcShell";
import { useZcSession } from "@/components/zecarreto/useZcSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";
import { formatBRL } from "@/lib/zecarreto/domain/money";

export const Route = createFileRoute("/zecarreto/admin/precos")({ component: PrecosPage });

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Tariff {
  id: string;
  name: string;
  category_id: string;
  region_id: string | null;
  base_fare_cents: number;
  included_km: number;
  price_per_km_cents: number;
  price_per_minute_cents: number;
  minimum_fare_cents: number;
  extra_stop_cents: number;
  helper_cents: number;
  immediate_surcharge_pct: number;
  night_surcharge_pct: number;
  weekend_surcharge_pct: number;
  platform_commission_pct: number;
  service_fee_cents: number;
  service_fee_pct: number;
  toll_policy: "none" | "fixed" | "route";
  toll_fixed_cents: number;
  toll_applies_above_km: number;
  cancellation_fee_cents: number;
  cancellation_free_seconds: number;
  active: boolean;
  valid_to: string | null;
}

interface Addon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  pricing_mode: "fixed" | "per_unit" | "per_floor" | "percent";
  amount_cents: number;
  percent: number;
  max_quantity: number;
  requires_quantity: boolean;
  active: boolean;
  sort_order: number;
}

/**
 * Motor de tarifas na mão do dono.
 *
 * Publicar um preço novo NÃO apaga o antigo: a tarifa anterior é fechada
 * com data de fim e continua guardada. Assim, uma conta de mês passado
 * continua explicável pelo preço que valia no dia — como guardar o
 * cardápio antigo para conferir uma conta antiga.
 */
function PrecosPage() {
  const { session, loading } = useZcSession({ required: true });
  const [categories, setCategories] = useState<Category[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Tariff>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  async function load() {
    try {
      const [catalog, tariffList, addonList] = await Promise.all([
        zcApi<{ categories: Category[] }>("/catalog"),
        zcApi<Tariff[]>("/admin/tariffs"),
        zcApi<Addon[]>("/admin/addons"),
      ]);
      setCategories(catalog.categories);
      const vigentes = tariffList.filter((tariff) => tariff.active && tariff.valid_to === null);
      setTariffs(vigentes);
      setDrafts(Object.fromEntries(vigentes.map((tariff) => [tariff.category_id, { ...tariff }])));
      setAddons(addonList);
    } catch (error) {
      const message = zcErrorMessage(error);
      if (message.includes("administrador") || message.includes("perfil")) setDenied(true);
      else toast.error(message);
    }
  }

  useEffect(() => {
    if (!session) return;
    load();
  }, [session]);

  async function publicar(categoryId: string) {
    const draft = drafts[categoryId];
    if (!draft) return;
    setSavingId(categoryId);
    try {
      await zcApi("/admin/tariffs", {
        method: "POST",
        body: {
          name: draft.name,
          category_id: draft.category_id,
          region_id: draft.region_id,
          base_fare_cents: Number(draft.base_fare_cents),
          included_km: Number(draft.included_km),
          price_per_km_cents: Number(draft.price_per_km_cents),
          price_per_minute_cents: Number(draft.price_per_minute_cents),
          minimum_fare_cents: Number(draft.minimum_fare_cents),
          extra_stop_cents: Number(draft.extra_stop_cents),
          helper_cents: Number(draft.helper_cents),
          immediate_surcharge_pct: Number(draft.immediate_surcharge_pct),
          night_surcharge_pct: Number(draft.night_surcharge_pct),
          weekend_surcharge_pct: Number(draft.weekend_surcharge_pct),
          platform_commission_pct: Number(draft.platform_commission_pct),
          service_fee_cents: Number(draft.service_fee_cents),
          service_fee_pct: Number(draft.service_fee_pct),
          toll_policy: draft.toll_policy,
          toll_fixed_cents: Number(draft.toll_fixed_cents),
          toll_applies_above_km: Number(draft.toll_applies_above_km),
          cancellation_fee_cents: Number(draft.cancellation_fee_cents),
          cancellation_free_seconds: Number(draft.cancellation_free_seconds),
        },
      });
      toast.success("Preço publicado. Pedidos já fechados não mudam.");
      await load();
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  async function salvarAdicional(addon: Addon) {
    setSavingId(addon.id);
    try {
      await zcApi("/admin/addons", {
        method: "POST",
        body: {
          id: addon.id,
          code: addon.code,
          name: addon.name,
          description: addon.description ?? undefined,
          pricing_mode: addon.pricing_mode,
          amount_cents: Number(addon.amount_cents),
          percent: Number(addon.percent),
          max_quantity: Number(addon.max_quantity),
          requires_quantity: addon.requires_quantity,
          sort_order: Number(addon.sort_order),
          active: addon.active,
        },
      });
      toast.success("Adicional salvo.");
      await load();
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (denied) {
    return (
      <ZcShell title="Preços" back={{ to: "/zecarreto", label: "Início" }}>
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-600">
          Esta área é só do administrador da plataforma.
        </p>
      </ZcShell>
    );
  }

  return (
    <ZcShell
      title="Preços e adicionais"
      subtitle="Tudo que o cliente paga sai daqui. Publicar um preço novo não mexe em pedido já fechado."
      back={{ to: "/zecarreto/admin", label: "Aprovações" }}
    >
      {categories.map((category) => {
        const draft = drafts[category.id];
        if (!draft) {
          return (
            <div
              key={category.id}
              className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500"
            >
              <strong>{category.name}</strong>: sem tarifa cadastrada.
            </div>
          );
        }
        const set = (patch: Partial<Tariff>) =>
          setDrafts({ ...drafts, [category.id]: { ...draft, ...patch } });

        return (
          <div
            key={category.id}
            className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-neutral-400" />
              <p className="font-semibold">{category.name}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Money
                label="Bandeirada"
                value={draft.base_fare_cents}
                onChange={(v) => set({ base_fare_cents: v })}
              />
              <Numero
                label="Km inclusos na bandeirada"
                value={draft.included_km}
                onChange={(v) => set({ included_km: v })}
                hint="Só o que passar disso é cobrado por km."
              />
              <Money
                label="Valor por km excedente"
                value={draft.price_per_km_cents}
                onChange={(v) => set({ price_per_km_cents: v })}
              />
              <Money
                label="Valor por minuto"
                value={draft.price_per_minute_cents}
                onChange={(v) => set({ price_per_minute_cents: v })}
              />
              <Money
                label="Tarifa mínima (piso)"
                value={draft.minimum_fare_cents}
                onChange={(v) => set({ minimum_fare_cents: v })}
              />
              <Money
                label="Parada extra"
                value={draft.extra_stop_cents}
                onChange={(v) => set({ extra_stop_cents: v })}
              />
              <Money
                label="Ajudante"
                value={draft.helper_cents}
                onChange={(v) => set({ helper_cents: v })}
              />
              <Numero
                label="Acréscimo do imediato (%)"
                value={draft.immediate_surcharge_pct}
                onChange={(v) => set({ immediate_surcharge_pct: v })}
              />
              <Numero
                label="Acréscimo noturno (%)"
                value={draft.night_surcharge_pct}
                onChange={(v) => set({ night_surcharge_pct: v })}
              />
              <Numero
                label="Acréscimo fim de semana (%)"
                value={draft.weekend_surcharge_pct}
                onChange={(v) => set({ weekend_surcharge_pct: v })}
              />
              <Numero
                label="Comissão da plataforma (%)"
                value={draft.platform_commission_pct}
                onChange={(v) => set({ platform_commission_pct: v })}
                hint="Descontada do carreteiro."
              />
              <Money
                label="Taxa de serviço fixa"
                value={draft.service_fee_cents}
                onChange={(v) => set({ service_fee_cents: v })}
                hint="Cobrada do cliente."
              />
              <Numero
                label="Taxa de serviço (%)"
                value={draft.service_fee_pct}
                onChange={(v) => set({ service_fee_pct: v })}
              />
              <div className="space-y-1.5">
                <Label>Pedágio</Label>
                <select
                  value={draft.toll_policy}
                  onChange={(event) =>
                    set({ toll_policy: event.target.value as Tariff["toll_policy"] })
                  }
                  className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
                >
                  <option value="none">Não cobrar</option>
                  <option value="fixed">Valor fixo acima de X km</option>
                  <option value="route">Vem do serviço de mapas</option>
                </select>
              </div>
              {draft.toll_policy === "fixed" && (
                <>
                  <Money
                    label="Pedágio (valor)"
                    value={draft.toll_fixed_cents}
                    onChange={(v) => set({ toll_fixed_cents: v })}
                  />
                  <Numero
                    label="Cobrar pedágio acima de (km)"
                    value={draft.toll_applies_above_km}
                    onChange={(v) => set({ toll_applies_above_km: v })}
                  />
                </>
              )}
              <Money
                label="Taxa de cancelamento"
                value={draft.cancellation_fee_cents}
                onChange={(v) => set({ cancellation_fee_cents: v })}
              />
              <Numero
                label="Cancelar de graça até (segundos)"
                value={draft.cancellation_free_seconds}
                onChange={(v) => set({ cancellation_free_seconds: v })}
              />
            </div>

            <Button disabled={savingId === category.id} onClick={() => publicar(category.id)}>
              {savingId === category.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Publicar preço novo
            </Button>
          </div>
        );
      })}

      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="font-semibold">Adicionais</p>
        {addons.map((addon) => (
          <div key={addon.id} className="space-y-3 border-b border-neutral-100 pb-4 last:border-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{addon.name}</p>
                <p className="text-xs text-neutral-500">
                  código {addon.code} ·{" "}
                  {addon.pricing_mode === "percent"
                    ? `${addon.percent}% sobre o valor`
                    : addon.pricing_mode === "per_floor"
                      ? `${formatBRL(addon.amount_cents)} por andar`
                      : addon.pricing_mode === "per_unit"
                        ? `${formatBRL(addon.amount_cents)} por item`
                        : formatBRL(addon.amount_cents)}
                </p>
              </div>
              <Button
                variant={addon.active ? "outline" : "default"}
                size="sm"
                onClick={() =>
                  setAddons(
                    addons.map((item) =>
                      item.id === addon.id ? { ...item, active: !item.active } : item,
                    ),
                  )
                }
              >
                {addon.active ? "Ativo" : "Inativo"}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {addon.pricing_mode === "percent" ? (
                <Numero
                  label="Percentual"
                  value={addon.percent}
                  onChange={(v) =>
                    setAddons(
                      addons.map((item) => (item.id === addon.id ? { ...item, percent: v } : item)),
                    )
                  }
                />
              ) : (
                <Money
                  label="Valor"
                  value={addon.amount_cents}
                  onChange={(v) =>
                    setAddons(
                      addons.map((item) =>
                        item.id === addon.id ? { ...item, amount_cents: v } : item,
                      ),
                    )
                  }
                />
              )}
              <Numero
                label="Quantidade máxima"
                value={addon.max_quantity}
                onChange={(v) =>
                  setAddons(
                    addons.map((item) =>
                      item.id === addon.id ? { ...item, max_quantity: v } : item,
                    ),
                  )
                }
              />
              <div className="flex items-end">
                <Button
                  size="sm"
                  disabled={savingId === addon.id}
                  onClick={() => salvarAdicional(addon)}
                >
                  {savingId === addon.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ZcShell>
  );
}

/** Campo em reais que guarda centavos por baixo. */
function Money({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (cents: number) => void;
  hint?: string;
}) {
  const [text, setText] = useState((value / 100).toFixed(2).replace(".", ","));
  useEffect(() => {
    setText((value / 100).toFixed(2).replace(".", ","));
  }, [value]);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        inputMode="decimal"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = Number(event.target.value.replace(/\./g, "").replace(",", "."));
          if (Number.isFinite(parsed)) onChange(Math.round(parsed * 100));
        }}
      />
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

function Numero({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        inputMode="decimal"
        value={String(value)}
        onChange={(event) => {
          const parsed = Number(event.target.value.replace(",", "."));
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
      />
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
