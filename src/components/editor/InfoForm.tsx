import { useState, useEffect } from "react";
import { Image as ImageIcon, Save, Upload, Video as VideoIcon, Zap, RefreshCw, Copy, Wand2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantRow } from "@/lib/site/types";
import { formatPhoneMask, slugify, subdomainify, getPizzeriaPublicUrl } from "@/lib/site/format";
import { generateApiKey, registerPizzeriaInFlycontrol } from "@/lib/site/flycontrol";
import { updateRestaurant } from "@/lib/site/queries";

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
  const [showApiKey, setShowApiKey] = useState(false);

    useEffect(() => {
      if (r.id) {
        supabase
          .rpc("get_restaurant_flycontrol_key", { p_restaurant_id: r.id })
          .then(({ data }) => {
            if (data) {
              set("flycontrol_api_key", data);
            }
          });
      }
    }, [r.id]);

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
    
    const updates: Partial<RestaurantRow> = {
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
      selected_template: r.selected_template || "black",
      business_type: r.business_type || "Pizzaria",
    };

    try {
      await updateRestaurant(r.id, updates);
      setMsg("Informações salvas!");
      onChange({ ...r, slug });
      setTimeout(() => setMsg(""), 2500);
    } catch (err: any) {
      console.error("[InfoForm] Erro ao salvar:", err);
      setMsg("Erro ao salvar: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
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
      const slug = (r.slug ?? "").trim();

      if (!r.id) {
        setRegMsg("SALVE as alterações antes de testar.");
        return;
      }

      setTesting(true);
      console.log("[FLYCONTROL] Botão 'Testar Conexão' clicado", { restaurant_id: r.id, slug });

      try {
        const { testFlycontrolConnection } = await import("@/lib/site/flycontrol");
        
        const result = await testFlycontrolConnection(r.id, slug);
        console.log("[FLYCONTROL] Resposta do teste recebida:", result);
        
        // Garantir que o resultado seja serializável e seguro para o estado
        const safeResult = {
          success: !!result.success,
          status: result.status || 0,
          url: result.url || "N/A",
          slugUsed: result.slugUsed || slug,
          apiKeyExists: !!result.apiKeyExists,
          error: result.error || null,
          details: result.details || null,
          data: result.data ? JSON.parse(JSON.stringify(result.data)) : null
        };
        
        setTestDebug(safeResult);

        if (safeResult.success) {
          setRegMsg("SUCESSO: Conexão com FlyControl estabelecida!");
        } else {
          setRegMsg("FALHA: Não foi possível conectar ao FlyControl.");
        }
      } catch (err: any) {
        console.error("[FLYCONTROL] Erro crítico no handleTestConnection:", err);
        setRegMsg("Erro ao executar teste: " + (err.message || String(err)));
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
      await updateRestaurant(r.id, updates);
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
        <Field label="Nome do Estabelecimento">
          <input
            value={r.name}
            onChange={(e) => set("name", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Tipo de Negócio">
          <select 
            value={r.business_type || "Pizzaria"}
            onChange={(e) => set("business_type", e.target.value as any)}
            className="input"
          >
            {["Pizzaria", "Pastelaria", "Hamburgueria", "Restaurante", "Lanchonete", "Açaíteria", "Farmácia", "Mercado", "Outro"].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
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
        <Field label="Slogan curto" hint="Ex: O melhor yakisoba ou a entrega mais rápida">
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

      <div className="space-y-4">
        <h3 className="text-lg font-black uppercase tracking-widest text-primary flex items-center gap-2">
          <Wand2 className="h-5 w-5" /> Aparência e Personalização do Site
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { 
              id: "black", 
              name: "Black Premium", 
              desc: "Escuro, elegante e gastronômico.",
              colors: ["#000", "#D97706"],
              mood: "Sofisticado"
            },
            { 
              id: "white", 
              name: "White Clean", 
              desc: "Versão clara, leve e moderna.",
              colors: ["#FFF", "#3B82F6"],
              mood: "Leve"
            },
            { 
              id: "pizza_hut_style", 
              name: "Pizza Red", 
              desc: "Estilo fast-food, visual vermelho.",
              colors: ["#E50914", "#FFF"],
              mood: "Popular"
            },
            { 
              id: "burger_style", 
              name: "Burger Showcase", 
              desc: "Moderno, foco em hamburguerias.",
              colors: ["#F3F4F6", "#D99000"],
              mood: "Comercial"
            }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => set("selected_template", t.id as any)}
              className={`relative overflow-hidden group flex flex-col p-4 rounded-2xl border-2 transition-all text-left ${
                (r.selected_template || "black") === t.id
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-white/5 bg-white/5 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{t.mood}</span>
                {(r.selected_template || "black") === t.id && (
                  <Zap className="h-3 w-3 text-primary fill-primary animate-pulse" />
                )}
              </div>
              
              <div className="h-20 rounded-xl mb-4 relative overflow-hidden flex items-center justify-center border border-white/10" style={{ background: t.colors[0] }}>
                 <div className="h-8 w-12 rounded-md shadow-2xl" style={{ background: t.colors[1] }} />
                 {t.id === "black" && <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/60" />}
              </div>

              <h4 className="font-black text-sm uppercase tracking-tight truncate">{t.name}</h4>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Configurações Visuais">
          <div className="space-y-3">
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

            <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
              <input
                type="checkbox"
                checked={r.site_settings?.show_categories_section ?? true}
                onChange={(e) => set("site_settings", { ...r.site_settings, show_categories_section: e.target.checked })}
                className="h-5 w-5 accent-primary"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold">Mostrar seção de categorias no início</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Exibe "Curadoria Gastronômica / Nossa Cozinha"</span>
              </div>
            </label>
          </div>
        </Field>
        <Field label="Texto do botão principal" hint='Ex: "Explorar Sabores"'>
          <input
            value={r.site_settings?.hero_button_text ?? ""}
            onChange={(e) => set("site_settings", { ...r.site_settings, hero_button_text: e.target.value })}
            placeholder="EXPLORAR CARDÁPIO"
            className="input"
          />
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

      <div className="space-y-4">
        <h3 className="text-lg font-black uppercase tracking-widest text-primary flex items-center gap-2">
          <Zap className="h-5 w-5" /> Comportamento Inicial do Cardápio
        </h3>
        <div className="card-premium p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Modo de Entrada" hint="Como o cliente visualiza o cardápio ao entrar">
              <select
                value={r.site_settings?.entry_mode || "navigation"}
                onChange={(e) => set("site_settings", { ...r.site_settings, entry_mode: e.target.value as any })}
                className="input"
              >
                <option value="navigation">Navegação por botão (modelo antigo)</option>
                <option value="direct">Exibir cardápio direto (novo padrão)</option>
              </select>
            </Field>
            
            <Field label="Visibilidade dos Combos" hint="Exibição da seção de combos especiais">
              <select
                value={r.site_settings?.combos_visibility || "auto"}
                onChange={(e) => set("site_settings", { ...r.site_settings, combos_visibility: e.target.value as any })}
                className="input"
              >
                <option value="auto">Automático (mostrar apenas se existir)</option>
                <option value="always">Sempre mostrar</option>
                <option value="hide">Ocultar</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-white/5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={r.site_settings?.show_hero_button !== false}
                onChange={(e) => set("site_settings", { ...r.site_settings, show_hero_button: e.target.checked })}
                className="h-5 w-5 accent-primary"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold">Mostrar botão principal no Hero</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Habilita o botão de CTA inicial</span>
              </div>
            </label>

            <Field label="Texto do botão principal" hint="Ex: Explorar Cardápio, Ver Sabores, Ver Delivery">
              <input
                value={r.site_settings?.hero_button_text ?? "Explorar Pizzas"}
                onChange={(e) => set("site_settings", { ...r.site_settings, hero_button_text: e.target.value })}
                placeholder="Explorar Cardápio"
                className="input"
                disabled={r.site_settings?.show_hero_button === false}
              />
            </Field>
          </div>
        </div>
      </div>

           <div className="flex items-center gap-5 pt-6">
             <button
               onClick={save}
               disabled={saving}
               className="btn-premium px-12 py-4 rounded-2xl flex items-center gap-3 shadow-2xl uppercase text-xs tracking-[0.2em]"
             >
               <Save className="h-6 w-6 text-primary-foreground" />
               <span>{saving ? "Salvando..." : "Salvar Configurações"}</span>
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
                      type={showApiKey ? "text" : "password"}
                      value={r.flycontrol_api_key || ""}
                      onChange={(e) => set("flycontrol_api_key", e.target.value)}
                      placeholder="fc_..."
                      className="w-full font-mono text-xs bg-background border border-input px-3 py-2 rounded-lg pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4 opacity-50" />}
                    </button>
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
                        <div className={`p-4 rounded-xl border font-mono text-[10px] space-y-2 overflow-auto max-h-60 ${
                          testDebug.success ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
                        }`}>
                          <div className="flex justify-between border-b border-white/5 pb-1 mb-1">
                            <span className="font-bold uppercase">{testDebug.success ? "✅ Recebimento Confirmado" : "❌ Falha na Integração"}</span>
                            <span className={testDebug.success ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                              {testDebug.status || "ERROR"}
                            </span>
                          </div>
                          <p><span className="text-muted-foreground">ENDPOINT:</span> {testDebug.url}</p>
                          <p><span className="text-muted-foreground">SLUG:</span> {testDebug.slugUsed}</p>
                          {testDebug.details?.remote_status && (
                            <p><span className="text-muted-foreground">FLYCONTROL STATUS:</span> {testDebug.details.remote_status}</p>
                          )}
                          {testDebug.error && <p className="text-red-400 font-semibold"><span className="text-muted-foreground">MOTIVO:</span> {testDebug.error}</p>}
                          {testDebug.success && <p className="text-green-400 mt-1">O FlyControl confirmou o recebimento do pedido de teste com sucesso!</p>}
                          {testDebug.data && !testDebug.success && (
                            <div className="mt-2">
                              <span className="text-muted-foreground">RESPOSTA DO SERVIDOR:</span>
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