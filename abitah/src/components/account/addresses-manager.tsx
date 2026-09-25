"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/store/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { lookupCep } from "@/services/viacep";
import { useAsyncData } from "@/hooks/use-async-data";
import { addressSchema, brazilianStates, type AddressFormValues } from "@/lib/validations";
import { formatCep, onlyDigits } from "@/lib/utils";
import type { Address } from "@/types/catalog";

export function AddressesManager() {
  const supabase = getSupabaseBrowserClient();
  const { user } = useAuth();
  const { notify } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: "",
      recipient: "",
      cep: "",
      street: "",
      number: "",
      complement: "",
      district: "",
      city: "",
      state: "SP",
      isDefault: false,
    },
  });

  const loader = useCallback(async (): Promise<Address[]> => {
    if (!supabase || !user) return [];
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });

    return (data ?? []).map((row) => ({
        id: row.id as string,
        label: (row.label as string) ?? "",
        recipient: (row.recipient as string) ?? "",
        cep: (row.cep as string) ?? "",
        street: (row.street as string) ?? "",
        number: (row.number as string) ?? "",
        complement: (row.complement as string | null) ?? null,
        district: (row.district as string) ?? "",
        city: (row.city as string) ?? "",
        state: (row.state as string) ?? "",
      isDefault: row.is_default === true,
    }));
  }, [supabase, user]);

  const { data: addresses, refresh: load } = useAsyncData<Address[]>(loader, []);

  async function handleCepBlur(value: string) {
    setCepError(null);
    if (!value) return;
    const result = await lookupCep(value);
    if (!result.ok) {
      setCepError(result.error);
      return;
    }
    setValue("street", result.address.street, { shouldValidate: true });
    setValue("district", result.address.district, { shouldValidate: true });
    setValue("city", result.address.city, { shouldValidate: true });
    setValue("state", result.address.state as AddressFormValues["state"], {
      shouldValidate: true,
    });
  }

  async function onSubmit(values: AddressFormValues) {
    if (!supabase || !user) return;

    const current = addresses ?? [];
    if (values.isDefault) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    }

    const { error } = await supabase.from("addresses").insert({
      user_id: user.id,
      label: values.label,
      recipient: values.recipient,
      cep: onlyDigits(values.cep),
      street: values.street,
      number: values.number,
      complement: values.complement || null,
      district: values.district,
      city: values.city,
      state: values.state,
      is_default: Boolean(values.isDefault) || current.length === 0,
    });

    if (error) {
      notify("Não foi possível salvar o endereço.", "error");
      return;
    }

    notify("Endereço salvo.");
    reset();
    setShowForm(false);
    void load();
  }

  async function remove(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) {
      notify("Não foi possível remover o endereço.", "error");
      return;
    }
    notify("Endereço removido.", "info");
    void load();
  }

  async function makeDefault(id: string) {
    if (!supabase || !user) return;
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    void load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
          Meus endereços
        </h2>
        <Button size="sm" onClick={() => setShowForm((value) => !value)}>
          <Plus className="h-4 w-4" aria-hidden />
          {showForm ? "Cancelar" : "Novo endereço"}
        </Button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="rounded-card border border-ink-700 bg-ink-900 p-5"
        >
          <div className="grid gap-4 sm:grid-cols-6">
            <Field
              label="Apelido"
              htmlFor="end-label"
              required
              error={errors.label?.message}
              className="sm:col-span-3"
            >
              <Input id="end-label" placeholder="Casa, trabalho..." {...register("label")} />
            </Field>

            <Field
              label="Quem recebe"
              htmlFor="end-recipient"
              required
              error={errors.recipient?.message}
              className="sm:col-span-3"
            >
              <Input id="end-recipient" {...register("recipient")} />
            </Field>

            <Field
              label="CEP"
              htmlFor="end-cep"
              required
              error={errors.cep?.message ?? cepError ?? undefined}
              className="sm:col-span-2"
            >
              <Input
                id="end-cep"
                inputMode="numeric"
                {...register("cep", {
                  onChange: (event) => setValue("cep", formatCep(event.target.value)),
                  onBlur: (event) => handleCepBlur(event.target.value),
                })}
              />
            </Field>

            <Field
              label="Rua"
              htmlFor="end-street"
              required
              error={errors.street?.message}
              className="sm:col-span-4"
            >
              <Input id="end-street" {...register("street")} />
            </Field>

            <Field
              label="Número"
              htmlFor="end-number"
              required
              error={errors.number?.message}
              className="sm:col-span-2"
            >
              <Input id="end-number" {...register("number")} />
            </Field>

            <Field label="Complemento" htmlFor="end-complement" className="sm:col-span-4">
              <Input id="end-complement" {...register("complement")} />
            </Field>

            <Field
              label="Bairro"
              htmlFor="end-district"
              required
              error={errors.district?.message}
              className="sm:col-span-3"
            >
              <Input id="end-district" {...register("district")} />
            </Field>

            <Field
              label="Cidade"
              htmlFor="end-city"
              required
              error={errors.city?.message}
              className="sm:col-span-2"
            >
              <Input id="end-city" {...register("city")} />
            </Field>

            <Field
              label="UF"
              htmlFor="end-state"
              required
              error={errors.state?.message}
              className="sm:col-span-1"
            >
              <Select id="end-state" {...register("state")}>
                {brazilianStates.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-4 flex items-center gap-2.5">
            <Checkbox id="end-default" {...register("isDefault")} />
            <label htmlFor="end-default" className="text-xs text-smoke-300">
              Usar como endereço padrão
            </label>
          </div>

          <Button type="submit" size="lg" className="mt-5" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar endereço"}
          </Button>
        </form>
      ) : null}

      {addresses === null ? (
        <div className="h-32 animate-pulse rounded-card bg-ink-900" />
      ) : addresses.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-12 text-center text-sm text-smoke-300">
          Você ainda não cadastrou endereços.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="rounded-card border border-ink-700 bg-ink-900 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-500" aria-hidden />
                  <div>
                    <p className="text-sm font-bold text-white">
                      {address.label}
                      {address.isDefault ? (
                        <span className="ml-2 rounded bg-neon-500 px-1.5 py-0.5 text-[10px] font-bold text-ink-950">
                          Padrão
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-smoke-300">
                      {address.recipient}
                      <br />
                      {address.street}, {address.number}
                      {address.complement ? ` — ${address.complement}` : ""}
                      <br />
                      {address.district} — {address.city}/{address.state}
                      <br />
                      CEP {formatCep(address.cep)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  aria-label={`Remover endereço ${address.label}`}
                  className="p-1 text-smoke-400 transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {!address.isDefault ? (
                <button
                  type="button"
                  onClick={() => makeDefault(address.id)}
                  className="mt-3 text-xs font-semibold text-neon-400 hover:underline"
                >
                  Definir como padrão
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
