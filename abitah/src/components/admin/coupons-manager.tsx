"use client";

import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/hooks/use-async-data";
import { couponSchema } from "@/lib/validations";
import { formatCurrency } from "@/lib/utils";
import type { Coupon } from "@/types/catalog";

export function CouponsManager() {
  const supabase = getSupabaseBrowserClient();
  const { notify } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof couponSchema>>({
    resolver: zodResolver(couponSchema),
    defaultValues: { code: "", type: "percent", value: 10, minOrderValue: 0, description: "" },
  });

  const loader = useCallback(async (): Promise<Coupon[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    return (data ?? []).map((row) => ({
        id: row.id as string,
        code: row.code as string,
        type: row.type as Coupon["type"],
        value: Number(row.value ?? 0),
        minOrderValue: Number(row.min_order_value ?? 0),
        active: row.active === true,
        expiresAt: (row.expires_at as string | null) ?? null,
      description: (row.description as string) ?? "",
    }));
  }, [supabase]);

  const { data: coupons, refresh: load } = useAsyncData<Coupon[]>(loader, []);

  async function onSubmit(values: z.input<typeof couponSchema>) {
    if (!supabase) return;
    const { error } = await supabase.from("coupons").insert({
      code: String(values.code).toUpperCase(),
      type: values.type,
      value: Number(values.value),
      min_order_value: Number(values.minOrderValue),
      description: values.description,
      active: true,
    });

    if (error) {
      notify("Não foi possível criar o cupom. O código já pode existir.", "error");
      return;
    }
    notify("Cupom criado.");
    reset();
    void load();
  }

  async function toggle(coupon: Coupon) {
    if (!supabase) return;
    await supabase.from("coupons").update({ active: !coupon.active }).eq("id", coupon.id);
    void load();
  }

  async function remove(coupon: Coupon) {
    if (!supabase) return;
    if (!window.confirm(`Excluir o cupom ${coupon.code}?`)) return;
    await supabase.from("coupons").delete().eq("id", coupon.id);
    notify("Cupom excluído.", "info");
    void load();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="rounded-card border border-ink-700 bg-ink-900 p-5"
      >
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">Novo cupom</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-6">
          <Field label="Código" htmlFor="cup-code" required error={errors.code?.message} className="sm:col-span-2">
            <Input id="cup-code" placeholder="COMUNIDADE10" className="uppercase" {...register("code")} />
          </Field>
          <Field label="Tipo" htmlFor="cup-type" required className="sm:col-span-2">
            <Select id="cup-type" {...register("type")}>
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </Select>
          </Field>
          <Field label="Valor" htmlFor="cup-value" required error={errors.value?.message} className="sm:col-span-2">
            <Input id="cup-value" type="number" step="0.01" min="0" {...register("value")} />
          </Field>
          <Field
            label="Pedido mínimo (R$)"
            htmlFor="cup-min"
            error={errors.minOrderValue?.message}
            className="sm:col-span-2"
          >
            <Input id="cup-min" type="number" step="0.01" min="0" {...register("minOrderValue")} />
          </Field>
          <Field
            label="Descrição"
            htmlFor="cup-desc"
            required
            error={errors.description?.message}
            className="sm:col-span-4"
          >
            <Input id="cup-desc" placeholder="10% de desconto acima de R$ 149,00" {...register("description")} />
          </Field>
        </div>
        <Button type="submit" className="mt-5" disabled={isSubmitting}>
          <Plus className="h-4 w-4" aria-hidden />
          {isSubmitting ? "Criando..." : "Criar cupom"}
        </Button>
      </form>

      {coupons === null ? (
        <div className="h-48 animate-pulse rounded-card bg-ink-900" />
      ) : coupons.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-12 text-center text-sm text-smoke-300">
          Nenhum cupom cadastrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-700">
          <table className="w-full min-w-175 text-left text-sm">
            <thead className="bg-ink-850 text-[11px] uppercase tracking-wider text-smoke-300">
              <tr>
                <th scope="col" className="px-4 py-3">Código</th>
                <th scope="col" className="px-4 py-3">Desconto</th>
                <th scope="col" className="px-4 py-3">Pedido mínimo</th>
                <th scope="col" className="px-4 py-3">Descrição</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-900 text-smoke-300">
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className="px-4 py-3 font-bold text-white">{coupon.code}</td>
                  <td className="px-4 py-3">
                    {coupon.type === "percent" ? `${coupon.value}%` : formatCurrency(coupon.value)}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(coupon.minOrderValue)}</td>
                  <td className="px-4 py-3 text-xs">{coupon.description}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(coupon)}
                      className={coupon.active ? "text-neon-400" : "text-smoke-400"}
                    >
                      {coupon.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(coupon)}
                      aria-label={`Excluir cupom ${coupon.code}`}
                      className="rounded p-2 text-smoke-400 transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
