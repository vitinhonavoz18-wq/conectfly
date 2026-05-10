import { useState } from "react";
import { Image as ImageIcon, Save, Upload, Video as VideoIcon, Zap, RefreshCw, Copy, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantRow } from "@/lib/site/types";
import { formatPhoneMask, slugify } from "@/lib/site/format";
import { generateApiKey, registerPizzeriaInFlycontrol } from "@/lib/site/flycontrol";

interface Props {
  restaurant: RestaurantRow;
  onChange: (r: RestaurantRow) => void;
}

export function InfoForm({ restaurant, onChange }: Props) {
  const [r, setR] = useState(restaurant);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [registering, setRegistering] = useState(false);
   const [regMsg, setRegMsg] = useState("");
   const [testing, setTesting] = useState(false);

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

  const handleHeroVideoUpload = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      setMsg("Vídeo muito grande (máx. 25MB). Comprima antes de enviar.");
      return;
    }
    const ext = file.name.split(".").pop() ?? "mp4";
    const path = `${r.id}/hero-video-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      setMsg("Erro no upload: " + error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    set("hero_video_url", pub.publicUrl);
    set("hero_media_type", "video");
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
        hero_media_type: r.hero_media_type,
        hero_video_url: r.hero_video_url,
        primary_color: r.primary_color,
        secondary_color: r.secondary_color,
        flycontrol_enabled: r.flycontrol_enabled ?? false,
        flycontrol_api_url: r.flycontrol_api_url ?? null,
        flycontrol_api_key: r.flycontrol_api_key ?? null,
        flycontrol_base_url: r.flycontrol_base_url ?? null,
        flycontrol_register_url: r.flycontrol_register_url ?? null,
        flycontrol_tenant_id: r.flycontrol_tenant_id ?? null,
        whatsapp_enabled: r.whatsapp_enabled ?? true,
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

   const regenerateKey = () => {
     if (confirm("Isso invalidará a chave atual no FLYCONTROL. Deseja continuar?")) {
       set("flycontrol_api_key", generateApiKey());
     }
   };

   const copyKey = () => {
     if (r.flycontrol_api_key) {
       navigator.clipboard.writeText(r.flycontrol_api_key);
       setMsg("Chave copiada!");
       setTimeout(() => setMsg(""), 2000);
     }
   };

    const handleTestConnection = async () => {
      setRegMsg("");
      const baseUrl = (r.flycontrol_base_url ?? "").trim();
      if (!baseUrl) {
        setRegMsg("Informe a URL base do FLYCONTROL primeiro.");
        return;
      }
      setTesting(true);
      try {
        // Tenta buscar o endpoint de pedidos resolvido
        const { sendOrderToFlycontrol, buildOrderPayload } = await import("@/lib/site/flycontrol");
        
        // Payload de teste fake
        const { buildOrderMessage } = await import("@/lib/site/orderFormatter");
        
        const testOrderData = {
          customer: {
            name: "João Silva (TESTE)",
            phone: "71999999999",
            address: "Rua das Flores, 123",
          },
          items: [
            { itemId: "t1", name: "Pizza Calabresa", quantity: 1, unitPrice: 49.9, description: "" },
            { itemId: "t2", name: "Coca-Cola 2L", quantity: 2, unitPrice: 12.0, description: "" }
          ],
          subtotal: 73.9,
          deliveryFee: 0,
          total: 73.9,
          paymentMethod: "PIX",
          notes: "Sem cebola\nBorda recheada",
          createdAt: new Date().toISOString(),
        };

        const messageFull = buildOrderMessage(testOrderData, "complete");

        const testPayload = buildOrderPayload({
          ...testOrderData.customer,
          items: testOrderData.items,
          subtotal: testOrderData.subtotal,
          paymentMethod: testOrderData.paymentMethod,
          notes: messageFull,
        });

       console.log("[FLYCONTROL] Testando conexão com payload fake...");
       await sendOrderToFlycontrol(r, testPayload, { retries: 0 });
       setRegMsg("STATUS: ONLINE - O painel FLYCONTROL respondeu corretamente!");
       console.log("[FLYCONTROL] Teste concluído com sucesso.");
      } catch (err) {
        setRegMsg("Falha no teste: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setTesting(false);
      }
    };

   const handleAutoRegister = async () => {
    setRegMsg("");
    const baseUrl = (r.flycontrol_base_url ?? "").trim();
    if (!baseUrl) {
      setRegMsg("Informe a URL base do FLYCONTROL primeiro.");
      return;
    }
    setRegistering(true);
    try {
       const out = await registerPizzeriaInFlycontrol(baseUrl, {
        name: r.name,
        phone: r.whatsapp_number ?? "",
        address: r.address ?? "",
        slug: r.slug || slugify(r.name),
        api_key: r.flycontrol_api_key || undefined,
       }, r.flycontrol_register_url);
      
      const updates: Partial<RestaurantRow> = {
        flycontrol_tenant_id: out.tenant_id,
        flycontrol_api_key: out.api_key,
        flycontrol_enabled: true,
        // Se a API retornou um endpoint específico, usamos ele
        flycontrol_api_url: out.order_endpoint || (baseUrl.includes(".supabase.co") 
          ? baseUrl.replace(/\/+$/, "") + "/functions/v1/create-order"
          : baseUrl.replace(/\/+$/, "") + "/api/orders"),
      };
      const next = { ...r, ...updates } as RestaurantRow;
      setR(next);
      // Persist immediately so the credentials don't get lost on page refresh
      const { error } = await supabase
        .from("restaurants")
        .update(updates)
        .eq("id", r.id);
      if (error) throw error;
      onChange(next);
      setRegMsg("Pizzaria registrada no FLYCONTROL com sucesso!");
    } catch (err) {
      setRegMsg("Falha: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRegistering(false);
    }
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
        <Field label="Mídia do Hero" hint="Escolha imagem ou vídeo animado para o fundo">
          <div className="space-y-3">
            <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => set("hero_media_type", "image")}
                className={`px-3 py-1.5 inline-flex items-center gap-1.5 transition ${
                  r.hero_media_type !== "video"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-muted"
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" /> Imagem
              </button>
              <button
                type="button"
                onClick={() => set("hero_media_type", "video")}
                className={`px-3 py-1.5 inline-flex items-center gap-1.5 transition ${
                  r.hero_media_type === "video"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-muted"
                }`}
              >
                <VideoIcon className="h-3.5 w-3.5" /> Vídeo
              </button>
            </div>

            {r.hero_media_type === "video" ? (
              <div className="flex items-center gap-3">
                {r.hero_video_url && (
                  <video
                    src={r.hero_video_url}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="h-16 w-24 object-cover rounded-lg bg-black"
                  />
                )}
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-muted transition">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">Enviar vídeo (mp4/webm)</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleHeroVideoUpload(f);
                    }}
                  />
                </label>
              </div>
            ) : (
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
            )}
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

      <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Integração FLYCONTROL</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Envia cada pedido em tempo real para o painel FLYCONTROL desta pizzaria.
        </p>

        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!r.flycontrol_enabled}
            onChange={(e) => set("flycontrol_enabled", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="font-semibold">Ativar envio para FLYCONTROL</span>
        </label>

        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={r.whatsapp_enabled !== false}
            onChange={(e) => set("whatsapp_enabled", e.target.checked)}
            className="h-4 w-4"
          />
          <span>Continuar abrindo WhatsApp ao finalizar pedido</span>
        </label>

         <div className="space-y-4 pt-2">
            <Field
              label="URL do Painel FLYCONTROL"
              hint="Copie a URL do seu painel aberto (ex: https://flycontrol-xxxx.lovable.app)"
            >
              <input
                value={r.flycontrol_base_url ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  set("flycontrol_base_url", val);
                  
                  // Requirement 3: Auto-generate endpoint if base URL is pasted
                  if (val && !r.flycontrol_api_url) {
                    let base = val.trim();
                    if (!base.startsWith("http")) base = "https://" + base;
                    base = base.replace(/\/+$/, "");
                    
                    let autoEndpoint = "";
                    if (base.includes(".supabase.co")) {
                      autoEndpoint = base + "/functions/v1/create-order";
                    } else {
                      autoEndpoint = base + "/api/orders";
                    }
                    set("flycontrol_api_url", autoEndpoint);
                  }
                }}
                placeholder="https://sua-url-do-flycontrol.lovable.app"
                className="input"
              />
            </Field>

           <Field
             label="Endpoint de Criação Automática"
             hint="URL específica para registrar novas pizzarias no FLYCONTROL (Opcional)"
           >
             <input
               value={r.flycontrol_register_url ?? ""}
               onChange={(e) => set("flycontrol_register_url", e.target.value)}
               placeholder="https://sua-url.lovable.app/api/pizzerias/create"
               className="input"
             />
           </Field>

           <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
             <div className="flex items-center justify-between">
               <span className="text-sm font-semibold">Identificação da Pizzaria</span>
               {r.flycontrol_tenant_id && (
                 <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded uppercase">
                   ID: {r.flycontrol_tenant_id}
                 </span>
               )}
             </div>
             
             <div className="space-y-1">
               <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                 <span>API Key (Gerada aqui ou colada do FLYCONTROL)</span>
               </div>
               <div className="flex gap-2">
                 <input
                   value={r.flycontrol_api_key || ""}
                   onChange={(e) => set("flycontrol_api_key", e.target.value)}
                   placeholder="fc_..."
                   className="flex-1 font-mono text-xs bg-background border border-input px-3 py-2 rounded-lg"
                 />
                 <button
                   type="button"
                   onClick={copyKey}
                   className="p-2 rounded-lg bg-secondary hover:bg-muted transition"
                   title="Copiar Chave"
                 >
                   <Copy className="h-4 w-4" />
                 </button>
                 <button
                   type="button"
                   onClick={regenerateKey}
                   className="p-2 rounded-lg bg-secondary hover:bg-muted transition"
                   title="Gerar Nova Chave"
                 >
                   <RefreshCw className="h-4 w-4" />
                 </button>
               </div>
             </div>

             <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoRegister}
                      disabled={registering}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                      {registering ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      {registering ? "Vinculando..." : "Vincular / Registrar no FLYCONTROL"}
                    </button>
                    
                    {r.flycontrol_api_key && (
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-muted transition disabled:opacity-50"
                      >
                        {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        Testar Conexão
                      </button>
                    )}
                  </div>
                  {regMsg && (
                    <span className={`text-xs font-medium p-2 rounded bg-primary/10 border border-primary/20 ${regMsg.includes("Falha") || regMsg.includes("Erro") ? "text-destructive" : "text-primary"}`}>
                      {regMsg}
                    </span>
                  )}
                </div>
             </div>
           </div>

            <Field
              label="Endpoint de Pedidos"
              hint="Preenchido automaticamente ao colar a URL do Painel."
            >
              <input
                value={r.flycontrol_api_url ?? ""}
                onChange={(e) => set("flycontrol_api_url", e.target.value)}
                placeholder="https://.../api/orders"
                className="input text-xs"
              />
            </Field>
         </div>
        <p className="text-xs text-muted-foreground">
          ID interno desta pizzaria: <span className="font-mono">{r.id}</span>
        </p>
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