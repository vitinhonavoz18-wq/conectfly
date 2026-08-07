"use client";

import { useCallback, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/hooks/use-async-data";
import { siteConfig } from "@/config/site";

const fields = [
  { key: "whatsapp", label: "WhatsApp (somente dígitos, com 55)", placeholder: "5511999999999" },
  { key: "whatsapp_label", label: "WhatsApp exibido", placeholder: "(11) 99999-9999" },
  { key: "email", label: "E-mail de contato", placeholder: "contato@abitah.com.br" },
  { key: "instagram", label: "Instagram (URL)", placeholder: "https://instagram.com/abitah" },
  { key: "facebook", label: "Facebook (URL)", placeholder: "https://facebook.com/abitah" },
  { key: "address", label: "Endereço completo", placeholder: "Av. das Palmeiras, 1200 - Centro" },
  { key: "hours", label: "Horário de funcionamento", placeholder: "Seg a sex, 06h às 22h" },
  { key: "free_shipping_threshold", label: "Frete grátis a partir de (R$)", placeholder: "299" },
];

export function SettingsManager() {
  const supabase = getSupabaseBrowserClient();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  const loader = useCallback(async (): Promise<Record<string, string>> => {
    if (!supabase) return {};
    const { data } = await supabase.from("site_settings").select("key, value");
    const map: Record<string, string> = {};
    (data ?? []).forEach((row) => {
      map[row.key as string] = String(row.value ?? "");
    });
    return map;
  }, [supabase]);

  const { data: stored, setData: setValues } = useAsyncData<Record<string, string>>(loader, {});
  const values = stored ?? {};

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);

    const { error } = await supabase.from("site_settings").upsert(
      fields.map((field) => ({ key: field.key, value: values[field.key] ?? "" })),
      { onConflict: "key" },
    );

    setSaving(false);
    if (error) {
      notify("Não foi possível salvar as configurações.", "error");
      return;
    }
    notify("Configurações salvas.");
  }

  if (stored === null) return <div className="h-96 animate-pulse rounded-card bg-ink-900" />;

  return (
    <form onSubmit={save} className="space-y-5">
      <p className="rounded-lg border border-ink-700 bg-ink-850 p-4 text-xs leading-relaxed text-smoke-300">
        Os valores padrão vêm de <code className="text-neon-400">src/config/site.ts</code>. O que
        você salvar aqui fica registrado no banco e serve como fonte única para futuras integrações
        (e-mails transacionais, automações e relatórios).
      </p>

      <div className="grid gap-4 rounded-card border border-ink-700 bg-ink-900 p-5 sm:grid-cols-2">
        {fields.map((field) => (
          <Field key={field.key} label={field.label} htmlFor={`set-${field.key}`}>
            <Input
              id={`set-${field.key}`}
              value={values[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) =>
                setValues((current) => ({ ...(current ?? {}), [field.key]: event.target.value }))
              }
            />
          </Field>
        ))}
      </div>

      <div className="rounded-card border border-ink-700 bg-ink-900 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
          Valores em uso agora
        </h2>
        <dl className="mt-4 grid gap-3 text-xs text-smoke-300 sm:grid-cols-2">
          <div>
            <dt className="text-smoke-400">WhatsApp</dt>
            <dd className="text-white">{siteConfig.contact.whatsapp}</dd>
          </div>
          <div>
            <dt className="text-smoke-400">E-mail</dt>
            <dd className="text-white">{siteConfig.contact.email}</dd>
          </div>
          <div>
            <dt className="text-smoke-400">Instagram</dt>
            <dd className="text-white">{siteConfig.social.instagramHandle}</dd>
          </div>
          <div>
            <dt className="text-smoke-400">Frete grátis a partir de</dt>
            <dd className="text-white">R$ {siteConfig.commerce.freeShippingThreshold},00</dd>
          </div>
        </dl>
      </div>

      <Button type="submit" size="lg" disabled={saving}>
        <Save className="h-4 w-4" aria-hidden />
        {saving ? "Salvando..." : "Salvar configurações"}
      </Button>
    </form>
  );
}
