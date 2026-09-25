"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { newsletterSchema, type NewsletterFormValues } from "@/lib/validations";
import { formatPhone } from "@/lib/utils";
import { siteConfig } from "@/config/site";

export function Newsletter() {
  const { notify } = useToast();
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { name: "", email: "", whatsapp: "" },
  });

  async function onSubmit(values: NewsletterFormValues) {
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("falha");
      notify("Cadastro confirmado! Você receberá as novidades em primeira mão.");
      setDone(true);
      reset();
    } catch {
      notify("Não conseguimos concluir o cadastro agora. Tente novamente.", "error");
    }
  }

  return (
    <section className="relative overflow-hidden bg-ink-950">
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-500/60 to-transparent"
        aria-hidden
      />
      <div className="container-page py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-neon-500">
            Newsletter
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold uppercase leading-[1] tracking-wide text-smoke-100 sm:text-4xl">
            {siteConfig.institutional.newsletterHeadline}
          </h2>
          <p className="mt-5 text-sm text-smoke-400">
            Sem spam. Apenas lançamentos, drops limitados e condições exclusivas da comunidade.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mx-auto mt-9 grid max-w-4xl gap-4 sm:grid-cols-3"
        >
          <Field label="Nome" htmlFor="nl-name" error={errors.name?.message}>
            <Input id="nl-name" placeholder="Seu nome" autoComplete="name" {...register("name")} />
          </Field>
          <Field label="E-mail" htmlFor="nl-email" error={errors.email?.message}>
            <Input
              id="nl-email"
              type="email"
              placeholder="voce@email.com"
              autoComplete="email"
              {...register("email")}
            />
          </Field>
          <Field label="WhatsApp" htmlFor="nl-whatsapp" error={errors.whatsapp?.message}>
            <Input
              id="nl-whatsapp"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              autoComplete="tel"
              {...register("whatsapp", {
                onChange: (event) => setValue("whatsapp", formatPhone(event.target.value)),
              })}
            />
          </Field>

          <div className="sm:col-span-3 sm:flex sm:justify-center">
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
              <Send className="h-4 w-4" aria-hidden />
              {isSubmitting ? "Enviando..." : done ? "Cadastrar outro" : "Quero receber"}
            </Button>
          </div>
        </form>

        <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-smoke-400">
          Ao cadastrar, você concorda com a nossa{" "}
          <Link
            href="/politicas/privacidade"
            className="text-neon-400 underline-offset-4 hover:underline"
          >
            política de privacidade
          </Link>
          . Pode cancelar quando quiser.
        </p>
      </div>
    </section>
  );
}
