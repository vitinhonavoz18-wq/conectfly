import { useEffect, useState } from "react";
import { Plus, Trash2, Save, ShoppingBag, Loader2, FileJson, ImageIcon, Upload, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BeverageRow, RestaurantRow } from "@/lib/site/types";
import { BeverageImport } from "./BeverageImport";

interface Props {
  restaurantId: string;
}

export function BeverageManager({ restaurantId }: Props) {
  const [beverages, setBeverages] = useState<BeverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pizzeria_beverages")
        .select("*")
        .eq("pizzeria_id", restaurantId)
        .order("sort_order", { ascending: true });
      
      if (error) {
        console.error("Error loading beverages:", error);
      } else {
        setBeverages((data ?? []) as unknown as BeverageRow[]);
        // Also fetch restaurant for settings
        const { data: rest } = await supabase.from("restaurants").select("*").eq("id", restaurantId).single();
        if (rest) setRestaurant(rest as any);
      }
    } catch (err) {
      console.error("Caught error loading beverages:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, [restaurantId]);

   const ensureAuthenticatedSession = async () => {
     console.log("[BeverageManager] Verificando sessão atual");
     const { data: { session }, error: sessionError } = await supabase.auth.getSession();
     
     if (sessionError) {
       console.error("[BeverageManager] Erro ao obter sessão:", sessionError);
     }
 
     if (!session) {
       console.warn("[BeverageManager] Nenhuma sessão encontrada");
       return null;
     }
 
     // Verificar se o token está prestes a expirar ou expirou (margem de 10 segundos)
     const isExpired = session.expires_at ? (session.expires_at * 1000) < (Date.now() + 10000) : true;
     
     if (isExpired) {
       console.log("[BeverageManager] JWT expirado ou próximo da expiração, tentando renovar sessão");
       const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
       
       if (refreshError || !newSession) {
         console.error("[BeverageManager] Falha ao renovar sessão:", refreshError);
         return null;
       }
       
       console.log("[BeverageManager] Sessão renovada com sucesso");
       return newSession;
     }
 
     console.log("[BeverageManager] Sessão atual verificada e válida");
     return session;
   };
 
   const addBeverage = async () => {
     if (!restaurantId) {
       toast.error("Erro: ID da pizzaria não encontrado.");
       return;
     }
 
     console.log("[BeverageManager] Tentando adicionar bebida");
     
     const session = await ensureAuthenticatedSession();
     if (!session) {
       toast.error("Sua sessão expirou. Faça login novamente para continuar.");
       return;
     }
 
     const { error } = await supabase.from("pizzeria_beverages").insert({
       pizzeria_id: restaurantId,
       name: "Nova Bebida",
       brand: "",
       size: "",
       price: 0,
       sort_order: beverages.length,
       is_active: true
     });
 
     if (error) {
       if (error.message.includes("JWT expired")) {
         console.log("[BeverageManager] Erro JWT detectado após verificação, tentando renovação forçada...");
         const { data: { session: refreshedSession }, error: secondRefreshError } = await supabase.auth.refreshSession();
         
         if (!secondRefreshError && refreshedSession) {
           const { error: retryError } = await supabase.from("pizzeria_beverages").insert({
             pizzeria_id: restaurantId,
             name: "Nova Bebida",
             brand: "",
             size: "",
             price: 0,
             sort_order: beverages.length,
           });
           
           if (!retryError) {
             console.log("[BeverageManager] Bebida adicionada com sucesso após renovação forçada");
             reload();
             return;
           }
         }
       }
       console.error("[BeverageManager] Erro ao adicionar bebida:", error);
       toast.error("Erro ao adicionar: " + error.message);
     } else {
       console.log("[BeverageManager] Bebida adicionada com sucesso");
       reload();
     }
   };

   const updateBeverage = async (id: string, patch: Partial<BeverageRow>) => {
     const session = await ensureAuthenticatedSession();
     if (!session) {
       toast.error("Sua sessão expirou. Faça login novamente para continuar.");
       return;
     }
 
     const { error } = await supabase
       .from("pizzeria_beverages")
       .update(patch as any)
       .eq("id", id);
     
     if (error) {
       if (error.message.includes("JWT expired")) {
         const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
         if (refreshedSession) {
           const { error: retryError } = await supabase
             .from("pizzeria_beverages")
             .update(patch as any)
             .eq("id", id);
           if (!retryError) {
             setBeverages((cur) => cur.map((b) => (b.id === id ? { ...b, ...patch } : b)));
             return;
           }
         }
       }
       toast.error("Erro ao salvar: " + error.message);
     } else {
       setBeverages((cur) => cur.map((b) => (b.id === id ? { ...b, ...patch } : b)));
     }
   };

   const removeBeverage = async (id: string) => {
     if (!confirm("Excluir esta bebida?")) return;
     
     const session = await ensureAuthenticatedSession();
     if (!session) {
       toast.error("Sua sessão expirou. Faça login novamente para continuar.");
       return;
     }
 
     const { error } = await supabase.from("pizzeria_beverages").delete().eq("id", id);
     if (error) {
       if (error.message.includes("JWT expired")) {
         const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
         if (refreshedSession) {
           const { error: retryError } = await supabase.from("pizzeria_beverages").delete().eq("id", id);
           if (!retryError) {
             reload();
             return;
           }
         }
       }
       toast.error("Erro ao excluir: " + error.message);
     } else {
       reload();
     }
   };

  if (loading) return <div className="p-4 text-center">Carregando bebidas...</div>;

  return (
    <div className="space-y-6">
      <div className="card-premium p-6 border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3 mb-6">
          <Settings2 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-black uppercase tracking-widest">Configurações de Exibição</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
              <input
                type="checkbox"
                checked={restaurant?.site_settings?.beverages_visibility ?? true}
                onChange={async (e) => {
                  const settings = { ...restaurant?.site_settings, beverages_visibility: e.target.checked };
                  await supabase.from("restaurants").update({ site_settings: settings } as any).eq("id", restaurantId);
                  toast.success("Visibilidade atualizada!");
                  // Update local state if we had it, but for now we just reload or rely on the fact that this is usually in a parent
                }}
                className="h-5 w-5 accent-primary"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold">Exibir bebidas no cardápio público</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Liga/Desliga a seção no site</span>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Posição da Categoria Bebidas</label>
            <select
              value={restaurant?.site_settings?.beverages_position ?? "end"}
              onChange={async (e) => {
                const settings = { ...restaurant?.site_settings, beverages_position: e.target.value };
                await supabase.from("restaurants").update({ site_settings: settings } as any).eq("id", restaurantId);
                toast.success("Posição atualizada!");
              }}
              className="input bg-white/5 border-white/10"
            >
              <option value="after_products">Depois dos produtos principais</option>
              <option value="after_combos">Depois dos combos</option>
              <option value="end">No final do cardápio</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-black uppercase tracking-widest">Catálogo de Bebidas</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 transition-all text-xs font-black uppercase tracking-widest"
          >
            <FileJson className="h-4 w-4 text-primary" /> Importar via JSON
          </button>
          <button
            onClick={addBeverage}
            className="btn-premium px-6 py-2.5 rounded-xl flex items-center gap-2 text-xs uppercase tracking-widest shadow-xl"
          >
            <Plus className="h-4 w-4" /> Nova Bebida
          </button>
        </div>
      </div>

      {beverages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-muted-foreground bg-white/5">
          Nenhuma bebida cadastrada.
        </div>
      ) : (
        <div className="grid gap-3">
          {beverages.map((b) => (
            <BeverageItemRow
              key={b.id}
              beverage={b}
              onUpdate={(patch) => updateBeverage(b.id, patch)}
              onRemove={() => removeBeverage(b.id)}
              restaurantId={restaurantId}
            />
          ))}
        </div>
      )}

      {showImport && (
        <BeverageImport
          restaurantId={restaurantId}
          onImportComplete={reload}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

function BeverageItemRow({
  beverage,
  restaurantId,
  onUpdate,
  onRemove,
}: {
  beverage: BeverageRow;
  restaurantId: string;
  onUpdate: (patch: Partial<BeverageRow>) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState({ ...beverage });

  const handleImageUpload = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${restaurantId}/beverage-${beverage.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      toast.error("Erro no upload: " + error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    onUpdate({ image_url: pub.publicUrl });
    setLocal(prev => ({ ...prev, image_url: pub.publicUrl }));
  };

  const commit = () => {
    if (JSON.stringify(local) === JSON.stringify(beverage)) return;
    onUpdate(local);
  };

  return (
    <div className={`card-premium p-4 grid grid-cols-1 gap-4 transition-opacity ${!local.is_active ? 'opacity-50' : ''}`}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative shrink-0 group">
          {local.image_url ? (
            <img
              src={local.image_url}
              alt={local.name}
              className="h-20 w-20 object-cover rounded-xl border border-white/10 bg-white/5 group-hover:border-primary/50 transition-colors"
            />
          ) : (
            <div className="h-20 w-20 rounded-xl border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center text-muted-foreground group-hover:border-primary/30 transition-colors">
              <ImageIcon className="h-7 w-7" />
            </div>
          )}
          <label
            title="Enviar foto da bebida"
            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-gradient-bronze text-primary-foreground inline-flex items-center justify-center cursor-pointer shadow-glow opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
          >
            <Upload className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_120px_120px] gap-3 flex-1">
          <div className="grid gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Nome</label>
            <input
              value={local.name}
              onChange={(e) => setLocal({ ...local, name: e.target.value })}
              onBlur={commit}
              className="input bg-black/20 border-white/5 focus:border-primary/40 font-bold"
              placeholder="Ex: Coca-Cola"
            />
          </div>
          
          <div className="grid gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Categoria</label>
            <select
              value={local.category ?? local.brand ?? "Bebidas"}
              onChange={(e) => {
                const val = e.target.value;
                setLocal({ ...local, category: val, brand: val });
                onUpdate({ category: val, brand: val });
              }}
              className="input bg-black/20 border-white/5 focus:border-primary/40 text-sm"
            >
              {["Refrigerantes", "Águas", "Sucos", "Cervejas", "Drinks", "Bebidas", "Outros"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Tamanho</label>
            <input
              value={local.size ?? ""}
              onChange={(e) => setLocal({ ...local, size: e.target.value })}
              onBlur={commit}
              className="input bg-black/20 border-white/5 focus:border-primary/40 text-sm"
              placeholder="Ex: 2L, Lata 350ml"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Preço (R$)</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[10px] font-black text-primary">R$</span>
              <input
                type="number"
                step="0.01"
                value={local.price}
                onChange={(e) => setLocal({ ...local, price: Number(e.target.value) })}
                onBlur={commit}
                className="input pl-8 bg-black/20 border-white/5 focus:border-primary/40 font-black text-emerald-400"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
        <div className="grid gap-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Descrição (opcional)</label>
          <input
            value={local.description ?? ""}
            onChange={(e) => setLocal({ ...local, description: e.target.value })}
            onBlur={commit}
            className="input bg-black/20 border-white/5 focus:border-primary/40 text-sm"
            placeholder="Ex: Gelada, servida com limão e gelo..."
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const next = !local.is_active;
            setLocal({ ...local, is_active: next });
            onUpdate({ is_active: next });
          }}
          className={`p-2 rounded-xl transition-all ${local.is_active ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}
          title={local.is_active ? "Ativa" : "Inativa"}
        >
          {local.is_active ? "Ativo" : "Inativo"}
        </button>
        <button
          onClick={onRemove}
          className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}