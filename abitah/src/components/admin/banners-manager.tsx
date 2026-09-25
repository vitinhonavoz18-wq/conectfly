"use client";

import { useCallback, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/hooks/use-async-data";
import type { Banner } from "@/types/catalog";

const bannerKeys = [
  { key: "home_hero", label: "Banner principal (Hero)" },
  { key: "home_community", label: "Banner da comunidade" },
  { key: "home_showcase", label: "Texto das vitrines" },
];

export function BannersManager() {
  const supabase = getSupabaseBrowserClient();
  const { notify } = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  const loader = useCallback(async (): Promise<Record<string, Banner>> => {
    if (!supabase) return {};
    const { data } = await supabase.from("banners").select("*").order("position");
    const map: Record<string, Banner> = {};
    (data ?? []).forEach((row) => {
      map[row.key as string] = {
        id: row.id as string,
        key: row.key as string,
        title: (row.title as string) ?? "",
        subtitle: (row.subtitle as string) ?? "",
        ctaLabel: (row.cta_label as string) ?? "",
        ctaHref: (row.cta_href as string) ?? "",
        imageUrl: (row.image_url as string | null) ?? null,
        active: row.active === true,
        position: Number(row.position ?? 0),
      };
    });
    return map;
  }, [supabase]);

  const { data: banners, refresh: load } = useAsyncData<Record<string, Banner>>(loader, {});

  async function save(key: string, values: Partial<Banner>) {
    if (!supabase) return;
    setSaving(key);

    const payload = {
      key,
      title: values.title ?? "",
      subtitle: values.subtitle ?? "",
      cta_label: values.ctaLabel ?? "",
      cta_href: values.ctaHref ?? "",
      image_url: values.imageUrl || null,
      active: true,
      position: values.position ?? 1,
    };

    const { error } = await supabase.from("banners").upsert(payload, { onConflict: "key" });
    setSaving(null);

    if (error) {
      notify("Não foi possível salvar o banner.", "error");
      return;
    }
    notify("Banner atualizado.");
    void load();
  }

  if (banners === null) return <div className="h-96 animate-pulse rounded-card bg-ink-900" />;

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-ink-700 bg-ink-850 p-4 text-xs leading-relaxed text-smoke-300">
        Estes textos substituem os valores padrão da página inicial. A URL da imagem pode apontar
        para um arquivo do Storage do Supabase ou para um arquivo dentro de <code>/public</code>.
      </p>

      {bannerKeys.map(({ key, label }, index) => {
        const banner = banners[key];
        return (
          <form
            key={key}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save(key, {
                title: String(form.get("title") ?? ""),
                subtitle: String(form.get("subtitle") ?? ""),
                ctaLabel: String(form.get("ctaLabel") ?? ""),
                ctaHref: String(form.get("ctaHref") ?? ""),
                imageUrl: String(form.get("imageUrl") ?? ""),
                position: index + 1,
              });
            }}
            className="rounded-card border border-ink-700 bg-ink-900 p-5"
          >
            <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">{label}</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              <Field label="Título" htmlFor={`${key}-title`} className="sm:col-span-6">
                <Input id={`${key}-title`} name="title" defaultValue={banner?.title ?? ""} />
              </Field>

              <Field label="Subtítulo" htmlFor={`${key}-subtitle`} className="sm:col-span-6">
                <Textarea
                  id={`${key}-subtitle`}
                  name="subtitle"
                  className="min-h-20"
                  defaultValue={banner?.subtitle ?? ""}
                />
              </Field>

              <Field label="Texto do botão" htmlFor={`${key}-cta`} className="sm:col-span-2">
                <Input id={`${key}-cta`} name="ctaLabel" defaultValue={banner?.ctaLabel ?? ""} />
              </Field>

              <Field label="Link do botão" htmlFor={`${key}-href`} className="sm:col-span-2">
                <Input id={`${key}-href`} name="ctaHref" defaultValue={banner?.ctaHref ?? "/loja"} />
              </Field>

              <Field
                label="URL da imagem"
                htmlFor={`${key}-image`}
                className="sm:col-span-2"
                hint="Deixe vazio para exibir o placeholder."
              >
                <Input id={`${key}-image`} name="imageUrl" defaultValue={banner?.imageUrl ?? ""} />
              </Field>
            </div>

            <Button type="submit" className="mt-5" disabled={saving === key}>
              <Save className="h-4 w-4" aria-hidden />
              {saving === key ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        );
      })}
    </div>
  );
}
