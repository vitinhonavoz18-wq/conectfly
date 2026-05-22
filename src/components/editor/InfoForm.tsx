import { useState } from "react";
import { Image as ImageIcon, Save, Upload, Video as VideoIcon, Zap, RefreshCw, Copy, Wand2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantRow } from "@/lib/site/types";
import { formatPhoneMask, slugify, subdomainify, getPizzeriaPublicUrl } from "@/lib/site/format";
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
    const [testDebug, setTestDebug] = useState<any>(null);

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
        custom_subdomain: r.custom_subdomain,
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
        show_item_images: r.show_item_images ?? true,
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

    const copySyncUrl = () => {
      const url = `https://watjejwgtieqfkpebkfz.supabase.co/functions/v1/menu-sync?slug=${r.slug}`;
      navigator.clipboard.writeText(url);
      setMsg("URL de Sincronização copiada!");
      setTimeout(() => setMsg(""), 2000);
    };

    const handleTestConnection = async () => {
      setRegMsg("");
      setTestDebug(null);
      const endpoint = (r.flycontrol_api_url ?? "").trim();
      const apiKey = (r.flycontrol_api_key ?? "").trim();
      const slug = (r.slug ?? "").trim();

      if (!endpoint || !apiKey) {
        setRegMsg("Informe o Endpoint de Pedidos e a API Key primeiro.");
        return;
      }

      setTesting(true);
      try {
        const { testFlycontrolConnection } = await import("@/lib/site/flycontrol");
        console.log("[FLYCONTROL] Iniciando teste de conexão real...");
        
        const result = await testFlycontrolConnection(endpoint, apiKey, slug);
        setTestDebug(result);

        if (result.success) {
          setRegMsg("STATUS: CONECTADO - O FlyControl aceitou o pedido de teste!");
        } else {
          setRegMsg("FALHA: O FlyControl recusou a conexão ou retornou erro.");
        }
      } catch (err) {
        setRegMsg("Erro inesperado: " + (err instanceof Error ? err.message : String(err)));
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
        <Field label="Identificador URL (slug)" hint="Caminho após conectfly.com.br/">
          <div className="flex gap-2 items-center">
            <input
              value={r.slug}
              onChange={(e) => set("slug", slugify(e.target.value))}
              className="input flex-1"
            />
          </div>
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
        <Field label="Configurações Visuais">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
            <input
              type="checkbox"
              checked={r.show_item_images ?? true}
              onChange={(e) => set("show_item_images", e.target.checked)}
              className="h-5 w-5 accent-primary"
            />
            <div className="flex flex-col">
              <span className="text-sm font-bold">Exibir imagens nos sabores/itens</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Habilita o anexo de fotos no cardápio</span>
            </div>
          </label>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cor primária (HSL)" hint='Ex: "0 84% 55%"'>
          <div className="flex gap-2 items-center">
            <input
              value={r.primary_color}
              onChange={(e) => set("primary_color", e.target.value)}
              className="input flex-1"
            />
             <span
               className="h-10 w-10 rounded-xl border border-white/20 shadow-lg"
               style={{ background: `hsl(${r.primary_color})` }}
             />
          </div>
        </Field>
        <Field label="Cor secundária (HSL)" hint='Ex: "45 93% 58%"'>
          <div className="flex gap-2 items-center">
            <input
              value={r.secondary_color}
              onChange={(e) => set("secondary_color", e.target.value)}
              className="input flex-1"
            />
             <span
               className="h-10 w-10 rounded-xl border border-white/20 shadow-lg"
               style={{ background: `hsl(${r.secondary_color})` }}
             />
          </div>
        </Field>
        </div>
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
             <label className="cursor-pointer inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all font-black text-xs uppercase tracking-widest shadow-xl">
               <Upload className="h-4 w-4 text-primary" />
               <span>Enviar Emblema</span>
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
                 <label className="cursor-pointer inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all font-black text-xs uppercase tracking-widest shadow-xl">
                   <Upload className="h-4 w-4 text-primary" />
                   <span>Upload Vídeo Gourmet</span>
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
                 <label className="cursor-pointer inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all font-black text-xs uppercase tracking-widest shadow-xl">
                   <Upload className="h-4 w-4 text-primary" />
                   <span>Upload Cenário (Hero)</span>
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

           <div className="flex items-center gap-5 pt-6">
             <button
               onClick={save}
               disabled={saving}
               className="btn-premium px-12 py-4 rounded-2xl flex items-center gap-3 shadow-2xl uppercase text-xs tracking-[0.2em]"
             >
               <Save className="h-6 w-6 text-primary-foreground" />
               <span>{saving ? "Salvando..." : "Preservar Receita"}</span>
             </button>
             {msg && <span className="text-sm font-black text-primary animate-pulse tracking-widest uppercase">{msg}</span>}
           </div>
 
           <div className="card-premium p-10 space-y-8 border-primary/20 bg-primary/5 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-5">
               <Zap className="h-32 w-32 text-primary" />
             </div>
             <div className="flex items-center gap-4 relative z-10">
               <div className="h-14 w-14 rounded-xl bg-gradient-bronze flex items-center justify-center shadow-glow">
                 <Zap className="h-8 w-8 text-primary-foreground" />
               </div>
               <div>
                 <h3 className="text-3xl font-black tracking-tighter uppercase">Conexão FLYCONTROL</h3>
                 <p className="text-muted-foreground italic">Engenharia gastronômica integrada em tempo real.</p>
               </div>
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
              hint="Copie a URL do seu painel aberto (ex: https://flycontrol.conectfly.com.br)"
            >
              <input
                value={r.flycontrol_base_url ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  set("flycontrol_base_url", val);
                  
                  // Auto-generate endpoint if base URL is pasted or if current is a test endpoint
                  if (val) {
                    const currentApiUrl = (r.flycontrol_api_url ?? "").toLowerCase();
                    const isTest = currentApiUrl.includes("test") || currentApiUrl.includes("connection");
                    
                    if (!r.flycontrol_api_url || isTest) {
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
                  }
                }}
                placeholder="https://flycontrol.conectfly.com.br"
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
               placeholder="https://conectfly.com.br/api/pizzerias/create"
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
                  <div className="relative flex-1">
                    <input
                      type={r.flycontrol_api_key?.startsWith("fc_") ? "password" : "text"}
                      value={r.flycontrol_api_key || ""}
                      onChange={(e) => set("flycontrol_api_key", e.target.value)}
                      placeholder="fc_..."
                      className="w-full font-mono text-xs bg-background border border-input px-3 py-2 rounded-lg pr-10"
                    />
                  </div>
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
                  {(regMsg || testDebug) && (
                    <div className="space-y-2 mt-2">
                      {regMsg && (
                        <div className={`text-xs font-black p-3 rounded-xl border ${regMsg.includes("FALHA") || regMsg.includes("Erro") ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-primary/10 border-primary/20 text-primary"} uppercase tracking-wider`}>
                          {regMsg}
                        </div>
                      )}
                      {testDebug && (
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-[10px] space-y-2 overflow-auto max-h-60">
                          <div className="flex justify-between border-b border-white/5 pb-1 mb-1">
                            <span className="text-muted-foreground">DEBUG INFO</span>
                            <span className={testDebug.success ? "text-green-500" : "text-red-500"}>
                              {testDebug.status || "ERROR"}
                            </span>
                          </div>
                          <p><span className="text-muted-foreground">ENDPOINT:</span> {testDebug.url}</p>
                          <p><span className="text-muted-foreground">SLUG:</span> {testDebug.slugUsed}</p>
                          <p><span className="text-muted-foreground">API KEY:</span> {testDebug.apiKeyExists ? "Presente (OK)" : "Ausente"}</p>
                          {testDebug.error && <p className="text-red-400"><span className="text-muted-foreground">ERROR:</span> {testDebug.error}</p>}
                          {testDebug.data && (
                            <div className="mt-2">
                              <span className="text-muted-foreground">RESPONSE:</span>
                              <pre className="mt-1 opacity-80 whitespace-pre-wrap">{JSON.stringify(testDebug.data, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
             </div>
           </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Field
                label="Endpoint de Sincronização do Cardápio"
                hint="Use esta URL no FlyControl para importar seu cardápio."
              >
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={`https://watjejwgtieqfkpebkfz.supabase.co/functions/v1/menu-sync?slug=${r.slug}`}
                    className="input text-xs flex-1 bg-white/5"
                  />
                  <button
                    type="button"
                    onClick={copySyncUrl}
                    className="p-2 rounded-lg bg-secondary hover:bg-muted transition"
                    title="Copiar URL de Sincronização"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </Field>
            </div>
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