"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/store/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { profileSchema } from "@/lib/validations";
import { formatCpf, formatPhone, onlyDigits } from "@/lib/utils";

export function ProfileForm() {
  const supabase = getSupabaseBrowserClient();
  const { user, profile, refreshProfile } = useAuth();
  const { notify } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", phone: "", cpf: "" },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      fullName: profile.fullName,
      phone: profile.phone ? formatPhone(profile.phone) : "",
      cpf: profile.cpf ? formatCpf(profile.cpf) : "",
    });
  }, [profile, reset]);

  async function onSubmit(values: z.input<typeof profileSchema>) {
    if (!supabase || !user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: values.fullName,
        phone: onlyDigits(String(values.phone)),
        cpf: values.cpf ? onlyDigits(String(values.cpf)) : null,
      })
      .eq("id", user.id);

    if (error) {
      notify("Não foi possível salvar suas alterações.", "error");
      return;
    }
    await refreshProfile();
    notify("Dados atualizados com sucesso.");
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-card border border-ink-700 bg-ink-900 p-5 sm:p-6"
    >
      <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
        Dados pessoais
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Nome completo"
          htmlFor="perfil-nome"
          required
          error={errors.fullName?.message}
          className="sm:col-span-2"
        >
          <Input id="perfil-nome" autoComplete="name" {...register("fullName")} />
        </Field>

        <Field label="E-mail" htmlFor="perfil-email" hint="Para alterar o e-mail, fale com o suporte.">
          <Input id="perfil-email" value={profile?.email ?? user?.email ?? ""} disabled readOnly />
        </Field>

        <Field label="WhatsApp" htmlFor="perfil-phone" required error={errors.phone?.message}>
          <Input
            id="perfil-phone"
            inputMode="tel"
            {...register("phone", {
              onChange: (event) => setValue("phone", formatPhone(event.target.value)),
            })}
          />
        </Field>

        <Field label="CPF" htmlFor="perfil-cpf" error={errors.cpf?.message}>
          <Input
            id="perfil-cpf"
            inputMode="numeric"
            {...register("cpf", {
              onChange: (event) => setValue("cpf", formatCpf(event.target.value)),
            })}
          />
        </Field>
      </div>

      <Button type="submit" size="lg" className="mt-5" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
