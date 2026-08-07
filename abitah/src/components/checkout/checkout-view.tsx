"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, MessageCircle, ShoppingBag } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { MediaFrame } from "@/components/ui/media-frame";
import { useCart } from "@/store/cart-context";
import { useAuth } from "@/store/auth-context";
import { useToast } from "@/components/ui/toast";
import { lookupCep } from "@/services/viacep";
import { orderWhatsappLink } from "@/lib/whatsapp";
import { checkoutSchema, brazilianStates, type CheckoutFormValues } from "@/lib/validations";
import { formatCep, formatCpf, formatCurrency, formatPhone } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import type { ShippingOptionId } from "@/types/cart";

export function CheckoutView() {
  const {
    items,
    hydrated,
    subtotal,
    discount,
    shippingPrice,
    total,
    coupon,
    shippingOption,
    setShippingOption,
    clear,
  } = useCart();
  const { profile } = useAuth();
  const { notify } = useToast();

  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error">("idle");
  const [cepError, setCepError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ code: string; link: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: "",
      cpf: "",
      email: "",
      phone: "",
      shippingMethod: shippingOption,
      cep: "",
      street: "",
      number: "",
      complement: "",
      district: "",
      city: "",
      state: "",
      notes: "",
      acceptTerms: false as unknown as true,
    },
  });

  // Pré-preenche com os dados da conta quando o cliente está logado.
  useEffect(() => {
    if (!profile) return;
    if (profile.fullName) setValue("fullName", profile.fullName);
    if (profile.email) setValue("email", profile.email);
    if (profile.phone) setValue("phone", formatPhone(profile.phone));
    if (profile.cpf) setValue("cpf", formatCpf(profile.cpf));
  }, [profile, setValue]);

  const shippingMethod = watch("shippingMethod") as ShippingOptionId;

  useEffect(() => {
    if (shippingMethod && shippingMethod !== shippingOption) setShippingOption(shippingMethod);
  }, [shippingMethod, shippingOption, setShippingOption]);

  async function handleCepBlur(value: string) {
    if (!value) return;
    setCepStatus("loading");
    setCepError(null);

    const result = await lookupCep(value);
    if (!result.ok) {
      setCepStatus("error");
      setCepError(result.error);
      return;
    }

    setCepStatus("idle");
    setValue("street", result.address.street, { shouldValidate: true });
    setValue("district", result.address.district, { shouldValidate: true });
    setValue("city", result.address.city, { shouldValidate: true });
    setValue("state", result.address.state, { shouldValidate: true });
  }

  async function onSubmit(values: CheckoutFormValues) {
    if (!items.length) {
      notify("Seu carrinho está vazio.", "error");
      return;
    }

    const isPickup = values.shippingMethod === "pickup";
    const address = isPickup
      ? null
      : {
          cep: values.cep ?? "",
          street: values.street ?? "",
          number: values.number ?? "",
          complement: values.complement,
          district: values.district ?? "",
          city: values.city ?? "",
          state: values.state ?? "",
        };

    const shippingLabel = siteConfig.commerce.shipping[values.shippingMethod].label;

    let code = "";
    try {
      const response = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            fullName: values.fullName,
            email: values.email,
            phone: values.phone,
            cpf: values.cpf,
          },
          address,
          shippingMethod: values.shippingMethod,
          shippingLabel,
          shippingPrice,
          couponCode: coupon?.code ?? null,
          discount,
          subtotal,
          total,
          notes: values.notes,
          items,
        }),
      });
      const data = (await response.json()) as { code?: string };
      code = data.code ?? "";
    } catch {
      notify("Não conseguimos registrar o pedido, mas você pode enviá-lo pelo WhatsApp.", "info");
    }

    const link = orderWhatsappLink({
      code: code || "SEM-CODIGO",
      customer: {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        cpf: values.cpf,
      },
      address,
      shippingLabel,
      items,
      subtotal,
      discount,
      couponCode: coupon?.code ?? null,
      shippingPrice,
      total,
      notes: values.notes,
    });

    setPlaced({ code: code || "—", link });
    clear();
    window.open(link, "_blank", "noopener,noreferrer");
  }

  if (!hydrated) {
    return (
      <div className="container-page py-20">
        <div className="h-40 animate-pulse rounded-card bg-ink-900" />
      </div>
    );
  }

  if (placed) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl rounded-card border border-neon-500/40 bg-ink-900 p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neon-500/12 text-neon-500">
            <MessageCircle className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="mt-5 text-xl font-black uppercase text-white">Pedido registrado!</h2>
          <p className="mt-2 text-sm text-smoke-300">
            Código do pedido: <strong className="text-neon-400">{placed.code}</strong>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-smoke-300">
            Abrimos o WhatsApp com todos os dados do seu pedido. Se a janela não abriu, use o botão
            abaixo para enviar a mensagem e concluir o atendimento.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={placed.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-lg bg-[#1FA02F] px-7 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#188427]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Enviar pedido no WhatsApp
            </a>
            <ButtonLink href="/loja" variant="outline" size="lg">
              Voltar para a loja
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container-page py-20">
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-card border border-ink-700 bg-ink-900 px-6 py-14 text-center">
          <ShoppingBag className="h-12 w-12 text-smoke-400" aria-hidden />
          <p className="text-sm text-smoke-300">
            Não há itens para finalizar. Escolha seus produtos e volte aqui.
          </p>
          <ButtonLink href="/loja" size="lg">
            Ir para a loja
          </ButtonLink>
        </div>
      </div>
    );
  }

  const isPickup = shippingMethod === "pickup";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_380px] lg:py-14"
    >
      <div className="space-y-6">
        <section className="rounded-card border border-ink-700 bg-ink-900 p-5 sm:p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            1. Seus dados
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label="Nome completo"
              htmlFor="fullName"
              required
              error={errors.fullName?.message}
              className="sm:col-span-2"
            >
              <Input id="fullName" autoComplete="name" {...register("fullName")} />
            </Field>

            <Field label="E-mail" htmlFor="email" required error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
            </Field>

            <Field label="Telefone / WhatsApp" htmlFor="phone" required error={errors.phone?.message}>
              <Input
                id="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                {...register("phone", {
                  onChange: (event) => setValue("phone", formatPhone(event.target.value)),
                })}
              />
            </Field>

            <Field
              label="CPF (opcional)"
              htmlFor="cpf"
              error={errors.cpf?.message}
              hint="Informe se precisar de nota fiscal em seu nome."
            >
              <Input
                id="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                {...register("cpf", {
                  onChange: (event) => setValue("cpf", formatCpf(event.target.value)),
                })}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-card border border-ink-700 bg-ink-900 p-5 sm:p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            2. Forma de entrega
          </h2>
          <div className="mt-5 space-y-2">
            {(["standard", "express", "pickup"] as ShippingOptionId[]).map((option) => {
              const config = siteConfig.commerce.shipping[option];
              return (
                <label
                  key={option}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                    shippingMethod === option
                      ? "border-neon-500 bg-neon-500/5"
                      : "border-ink-600 hover:border-smoke-400"
                  }`}
                >
                  <input
                    type="radio"
                    value={option}
                    className="mt-1 accent-[#29E23D]"
                    {...register("shippingMethod")}
                  />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2 text-xs font-bold text-white">
                      {config.label}
                      <span>{config.price === 0 ? "Grátis" : formatCurrency(config.price)}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-smoke-400">
                      {config.eta}
                      {option === "pickup"
                        ? ` — ${siteConfig.contact.address.street}, ${siteConfig.contact.address.city}/${siteConfig.contact.address.state}`
                        : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        {!isPickup ? (
          <section className="rounded-card border border-ink-700 bg-ink-900 p-5 sm:p-6">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
              3. Endereço de entrega
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              <Field
                label="CEP"
                htmlFor="cep"
                required
                error={errors.cep?.message ?? cepError ?? undefined}
                className="sm:col-span-2"
                hint={cepStatus === "loading" ? "Consultando endereço..." : undefined}
              >
                <Input
                  id="cep"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  {...register("cep", {
                    onChange: (event) => setValue("cep", formatCep(event.target.value)),
                    onBlur: (event) => handleCepBlur(event.target.value),
                  })}
                />
              </Field>

              <Field
                label="Rua / Avenida"
                htmlFor="street"
                required
                error={errors.street?.message}
                className="sm:col-span-4"
              >
                <Input id="street" autoComplete="address-line1" {...register("street")} />
              </Field>

              <Field
                label="Número"
                htmlFor="number"
                required
                error={errors.number?.message}
                className="sm:col-span-2"
              >
                <Input id="number" {...register("number")} />
              </Field>

              <Field
                label="Complemento"
                htmlFor="complement"
                error={errors.complement?.message}
                className="sm:col-span-4"
              >
                <Input id="complement" placeholder="Apto, bloco, referência" {...register("complement")} />
              </Field>

              <Field
                label="Bairro"
                htmlFor="district"
                required
                error={errors.district?.message}
                className="sm:col-span-3"
              >
                <Input id="district" {...register("district")} />
              </Field>

              <Field
                label="Cidade"
                htmlFor="city"
                required
                error={errors.city?.message}
                className="sm:col-span-2"
              >
                <Input id="city" autoComplete="address-level2" {...register("city")} />
              </Field>

              <Field
                label="UF"
                htmlFor="state"
                required
                error={errors.state?.message}
                className="sm:col-span-1"
              >
                <Select id="state" {...register("state")}>
                  <option value="">--</option>
                  {brazilianStates.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>
        ) : null}

        <section className="rounded-card border border-ink-700 bg-ink-900 p-5 sm:p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            {isPickup ? "3" : "4"}. Pagamento
          </h2>

          <div className="mt-5 rounded-lg border border-neon-500/35 bg-neon-500/5 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neon-400">
              <MessageCircle className="h-4 w-4" aria-hidden />
              Finalização pelo WhatsApp
            </p>
            <p className="mt-2 text-sm leading-relaxed text-smoke-300">
              Ao confirmar, enviamos o resumo completo do pedido para o nosso atendimento, que
              combina com você a melhor forma de pagamento (Pix, cartão ou link seguro) e confirma o
              prazo de entrega.
            </p>
          </div>

          <p className="mt-4 text-xs text-smoke-400">
            Pagamento online integrado (Pix, cartão, Mercado Pago, PagSeguro e Stripe) está em
            implantação e aparecerá aqui automaticamente assim que for ativado.
          </p>

          <div className="mt-5">
            <Field label="Observações do pedido" htmlFor="notes" error={errors.notes?.message}>
              <Textarea
                id="notes"
                placeholder="Alguma informação extra sobre tamanho, entrega ou presente?"
                {...register("notes")}
              />
            </Field>
          </div>

          <div className="mt-5 flex items-start gap-3">
            <Checkbox id="acceptTerms" {...register("acceptTerms")} />
            <label htmlFor="acceptTerms" className="text-xs leading-relaxed text-smoke-300">
              Li e aceito os{" "}
              <Link href="/politicas/termos" className="text-neon-400 underline-offset-4 hover:underline">
                termos de uso
              </Link>
              , a{" "}
              <Link href="/politicas/privacidade" className="text-neon-400 underline-offset-4 hover:underline">
                política de privacidade
              </Link>{" "}
              e a{" "}
              <Link href="/politicas/trocas" className="text-neon-400 underline-offset-4 hover:underline">
                política de troca
              </Link>
              .
            </label>
          </div>
          {errors.acceptTerms ? (
            <p className="mt-1.5 text-xs font-medium text-red-400">{errors.acceptTerms.message}</p>
          ) : null}
        </section>
      </div>

      <aside aria-label="Resumo do pedido">
        <div className="sticky top-24 rounded-card border border-ink-700 bg-ink-900 p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            Resumo do pedido
          </h2>

          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.key} className="flex gap-3">
                <MediaFrame
                  src={item.imageUrl}
                  alt={item.name}
                  label=""
                  className="aspect-3/4 w-14 shrink-0"
                  sizes="56px"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{item.name}</p>
                  <p className="mt-0.5 text-[11px] text-smoke-400">
                    {item.size} · {item.color} · {item.quantity}x
                  </p>
                </div>
                <p className="text-xs font-bold text-white">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2.5 border-t border-ink-700 pt-5 text-sm">
            <div className="flex justify-between text-smoke-300">
              <dt>Produtos</dt>
              <dd>{formatCurrency(subtotal)}</dd>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-neon-400">
                <dt>Desconto{coupon ? ` (${coupon.code})` : ""}</dt>
                <dd>-{formatCurrency(discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-smoke-300">
              <dt>Frete</dt>
              <dd>{shippingPrice === 0 ? "Grátis" : formatCurrency(shippingPrice)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-ink-700 pt-3 text-white">
              <dt className="text-sm font-bold uppercase">Total</dt>
              <dd className="text-2xl font-black">{formatCurrency(total)}</dd>
            </div>
          </dl>

          <Button type="submit" size="lg" fullWidth className="mt-6" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Lock className="h-4 w-4" aria-hidden />
            )}
            {isSubmitting ? "Registrando..." : "Finalizar pedido"}
          </Button>

          <p className="mt-3 text-center text-[11px] text-smoke-400">
            Seus dados são usados apenas para processar este pedido.
          </p>
        </div>
      </aside>
    </form>
  );
}
