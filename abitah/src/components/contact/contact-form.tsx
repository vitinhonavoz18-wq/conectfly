"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { contactSchema, type ContactFormValues } from "@/lib/validations";
import { formatPhone } from "@/lib/utils";

export function ContactForm() {
  const { notify } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", subject: "", message: "" },
  });

  async function onSubmit(values: ContactFormValues) {
    try {
      const response = await fetch("/api/contato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("falha");
      notify("Mensagem enviada! Respondemos em até 1 dia útil.");
      reset();
    } catch {
      notify("Não conseguimos enviar sua mensagem. Tente pelo WhatsApp.", "error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-card border border-ink-700 bg-ink-900 p-5 sm:p-6"
    >
      <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
        Envie uma mensagem
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="contato-nome" required error={errors.name?.message}>
          <Input id="contato-nome" autoComplete="name" {...register("name")} />
        </Field>

        <Field label="E-mail" htmlFor="contato-email" required error={errors.email?.message}>
          <Input id="contato-email" type="email" autoComplete="email" {...register("email")} />
        </Field>

        <Field label="WhatsApp" htmlFor="contato-phone" required error={errors.phone?.message}>
          <Input
            id="contato-phone"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            autoComplete="tel"
            {...register("phone", {
              onChange: (event) => setValue("phone", formatPhone(event.target.value)),
            })}
          />
        </Field>

        <Field label="Assunto" htmlFor="contato-subject" required error={errors.subject?.message}>
          <Input id="contato-subject" placeholder="Troca, pedido, dúvida..." {...register("subject")} />
        </Field>

        <Field
          label="Mensagem"
          htmlFor="contato-message"
          required
          error={errors.message?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id="contato-message"
            placeholder="Conte com detalhes como podemos ajudar."
            {...register("message")}
          />
        </Field>
      </div>

      <Button type="submit" size="lg" className="mt-5" disabled={isSubmitting}>
        <Send className="h-4 w-4" aria-hidden />
        {isSubmitting ? "Enviando..." : "Enviar mensagem"}
      </Button>
    </form>
  );
}
