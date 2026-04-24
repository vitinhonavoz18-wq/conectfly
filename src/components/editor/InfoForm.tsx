import { useState } from "react";
import { Save, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantRow } from "@/lib/site/types";
import { formatPhoneMask, slugify } from "@/lib/site/format";

interface Props {
  restaurant: RestaurantRow;
  onChange: (r: RestaurantRow) => void;
}

export function InfoForm({ restaurant, onChange }: Props) {
  const [r, setR] = useState(restaurant);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const set = <K extends keyof RestaurantRow>(k: K, v: RestaurantRow[K]) =>
    setR((p) => ({ ...p, [k]: v }));

  const handleLogoUpload = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${r.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      setMsg("Erro no upload: " + error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    set("logo_url", pub.publicUrl);
  };

  const handleHeroUpload = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${r.id}/hero-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      setMsg("Erro no upload: " + error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    set("hero_image_url", pub.publicUrl);
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    let slug = r.slug;
    if (!slug) slug = slugify(r.name);
    const { error } = await supabase
      .from("restaurants")
      .update({
        name: r.name,
        slug,
        tagline: r.tagline,
        description: r.description,
        whatsapp_number: r.whatsapp_number,
        whatsapp_display: r.whatsapp_display,
        address: r.address,
        hours: r.hours,
        city: r.city,
        logo_url: r.logo_url,
        hero_image_url: r.hero_image_url,
        primary_color: r.primary_color,
        secondary_color: r.secondary_color,
      })
      .eq("id", r.id);
    setSaving(false);
    if (error) {
      setMsg("Erro: " + error.message);
      return;
    }
    setMsg("Informações salvas!");
    onChange({ ...r, slug });
    setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome do restaurante">
          <input
            value={r.name}
            onChange={(e) => set("name", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="URL (slug)">
          <input
            value={r.slug}
            onChange={(e) => set("slug", slugify(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="Slogan curto" hint="Ex: O melhor yakisoba de Salvador">
          <input
            value={r.tagline ?? ""}
            onChange={(e) => set("tagline", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Cidade">
          <input
            value={r.city ?? ""}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Ex: Salvador, BA"
            className="input"
          />
        </Field>
      </div>

      <Field label="Descrição" hint="Texto curto que aparece no Hero">
        <textarea
          rows={3}
          value={r.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          className="input resize-none"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="WhatsApp (formato 55 + DDD + número)"
          hint="Ex: 5571986182819 — sem espaços, parênteses ou traços"
        >
          <input
            value={r.whatsapp_number}
            onChange={(e) => set("whatsapp_number", e.target.value.replace(/\D/g, ""))}
            placeholder="5571986182819"
            inputMode="numeric"
            className="input"
          />
        </Field>
        <Field label="WhatsApp para exibir no rodapé" hint="Ex: (71) 98618-2819">
          <input
            value={r.whatsapp_display ?? ""}
            onChange={(e) => set("whatsapp_display", formatPhoneMask(e.target.value))}
            placeholder="(71) 98618-2819"
            className="input"
          />
        </Field>
        <Field label="Endereço">
          <input
            value={r.address ?? ""}
            onChange={(e) => set("address", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Horário de funcionamento">
          <input
            value={r.hours ?? ""}
            onChange={(e) => set("hours", e.target.value)}
            placeholder="Ter-Dom 18h às 23h"
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Cor primária (HSL)" hint='Ex: "0 84% 55%" (vermelho)'>
          <div className="flex gap-2 items-center">
            <input
              value={r.primary_color}
              onChange={(e) => set("primary_color", e.target.value)}
              className="input flex-1"
            />
            <span
              className="h-9 w-9 rounded-lg border border-border"
              style={{ background: `hsl(${r.primary_color})` }}
            />
          </div>
        </Field>
        <Field label="Cor secundária (HSL)" hint='Ex: "45 93% 58%" (dourado)'>
          <div className="flex gap-2 items-center">
            <input
              value={r.secondary_color}
              onChange={(e) => set("secondary_color", e.target.value)}
              className="input flex-1"
            />
            <span
              className="h-9 w-9 rounded-lg border border-border"
              style={{ background: `hsl(${r.secondary_color})` }}
            />
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Logo (PNG transparente recomendado)">
          <div className="flex items-center gap-3">
            {r.logo_url && (
              <img
                src={r.logo_url}
                alt="Logo"
                className="h-16 w-16 object-contain bg-muted rounded-lg p-1"
              />
            )}
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-muted transition">
              <Upload className="h-4 w-4" />
              <span className="text-sm">Enviar logo</span>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                }}
              />
            </label>
          </div>
        </Field>
        <Field label="Imagem de fundo do Hero (opcional)">
          <div className="flex items-center gap-3">
            {r.hero_image_url && (
              <img
                src={r.hero_image_url}
                alt="Hero"
                className="h-16 w-24 object-cover rounded-lg"
              />
            )}
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-muted transition">
              <Upload className="h-4 w-4" />
              <span className="text-sm">Enviar imagem</span>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleHeroUpload(f);
                }}
              />
            </label>
          </div>
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition shadow-glow disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar informações"}
        </button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold block mb-1">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground block mt-1">{hint}</span>}
    </label>
  );
}