import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, ImageIcon, Upload, FolderPlus, Save, X, Loader2, GripVertical, FileJson, ShoppingBag } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BeverageRow, BeverageCatalogRow } from "@/lib/site/types";
import { BeverageImport } from "./BeverageImport";
import { formatBRL } from "@/lib/site/format";

interface Props {
  restaurantId: string;
}

export function BeverageManager({ restaurantId }: Props) {
  const [catalogs, setCatalogs] = useState<BeverageCatalogRow[]>([]);
  const [beverages, setBeverages] = useState<BeverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [isAddingCatalog, setIsAddingCatalog] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [isDragging, setIsDragging] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [catalogsRes, beveragesRes] = await Promise.all([
        supabase
          .from("beverage_catalogs")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("pizzeria_beverages")
          .select("*")
          .eq("pizzeria_id", restaurantId)
          .order("sort_order", { ascending: true })
      ]);

      if (catalogsRes.error) throw catalogsRes.error;
      if (beveragesRes.error) throw beveragesRes.error;

      setCatalogs(catalogsRes.data as unknown as BeverageCatalogRow[]);
      setBeverages(beveragesRes.data as unknown as BeverageRow[]);
    } catch (err: any) {
      console.error("Error loading beverage data:", err);
      toast.error("Erro ao carregar dados: " + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, [restaurantId]);

  const addCatalog = async () => {
    if (!newCatalogName.trim()) return;
    try {
      const { error } = await supabase.from("beverage_catalogs").insert({
        restaurant_id: restaurantId,
        name: newCatalogName,
        sort_order: catalogs.length,
        active: true
      });
      if (error) throw error;
      toast.success("Catálogo criado!");
      setNewCatalogName("");
      setIsAddingCatalog(false);
      reload();
    } catch (err: any) {
      toast.error("Erro ao criar catálogo: " + err.message);
    }
  };

  const deleteCatalog = async (id: string) => {
    const hasBeverages = beverages.some(b => b.catalog_id === id);
    if (hasBeverages) {
      if (!confirm("Este catálogo possui bebidas. Elas ficarão sem categoria. Deseja continuar?")) return;
    } else {
      if (!confirm("Excluir este catálogo?")) return;
    }

    try {
      const { error } = await supabase.from("beverage_catalogs").delete().eq("id", id);
      if (error) throw error;
      toast.success("Catálogo excluído!");
      reload();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const updateCatalog = async (id: string, patch: Partial<BeverageCatalogRow>) => {

    try {
      const { error } = await supabase.from("beverage_catalogs").update(patch as any).eq("id", id);
      if (error) throw error;
      setCatalogs(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    }
  };

  const addBeverage = async (catalogId?: string) => {
    try {
      const { error } = await supabase.from("pizzeria_beverages").insert({
        pizzeria_id: restaurantId,
        name: "Nova Bebida",
        price: 0,
        sort_order: beverages.length,
        is_active: true,
        catalog_id: catalogId || null
      });
      if (error) throw error;
      reload();
    } catch (err: any) {
      toast.error("Erro ao adicionar bebida: " + err.message);
    }
  };

  const updateBeverage = async (id: string, patch: Partial<BeverageRow>) => {

    try {
      const { error } = await supabase.from("pizzeria_beverages").update(patch as any).eq("id", id);
      if (error) throw error;
      setBeverages(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    }
  };

  const deleteBeverage = async (id: string) => {
    if (!confirm("Excluir esta bebida?")) return;
    try {
      const { error } = await supabase.from("pizzeria_beverages").delete().eq("id", id);
      if (error) throw error;
      reload();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  if (loading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" /> Carregando...</div>;

  const uncategorized = beverages.filter(b => !b.catalog_id || !catalogs.some(c => c.id === b.catalog_id));

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black uppercase tracking-widest text-primary">Catálogos de Bebidas</h3>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Organize suas bebidas por tipos e coleções</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 transition-all text-xs font-black uppercase tracking-widest"
          >
            <FileJson className="h-4 w-4 text-primary" /> Importar JSON
          </button>
          <button
            onClick={() => setIsAddingCatalog(true)}
            className="btn-premium px-6 py-2.5 rounded-xl flex items-center gap-2 text-xs uppercase tracking-widest shadow-xl"
          >
            <FolderPlus className="h-4 w-4" /> Novo Catálogo
          </button>
        </div>
      </div>

      {isAddingCatalog && (
        <div className="card-premium p-6 border-primary/30 animate-in slide-in-from-top-4">
          <h4 className="text-sm font-black uppercase tracking-widest mb-4">Criar Novo Catálogo</h4>
          <div className="flex gap-3">
            <input
              autoFocus
              value={newCatalogName}
              onChange={(e) => setNewCatalogName(e.target.value)}
              placeholder="Ex: Cervejas Artesanais, Refrigerantes 2L..."
              className="input flex-1"
              onKeyDown={(e) => e.key === "Enter" && addCatalog()}
            />
            <button onClick={addCatalog} className="btn-premium px-6 rounded-xl">Criar</button>
            <button onClick={() => setIsAddingCatalog(false)} className="px-4 hover:bg-white/5 rounded-xl"><X className="h-5 w-5" /></button>
          </div>
        </div>
      )}

      <div className="space-y-12">
        {catalogs.map(catalog => (
          <CatalogSection
            key={catalog.id}
            catalog={catalog}
            beverages={beverages.filter(b => b.catalog_id === catalog.id)}
            onUpdateCatalog={(patch: Partial<BeverageCatalogRow>) => updateCatalog(catalog.id, patch)}
            onDeleteCatalog={() => deleteCatalog(catalog.id)}
            onAddBeverage={() => addBeverage(catalog.id)}
            onUpdateBeverage={updateBeverage}
            onDeleteBeverage={deleteBeverage}
            restaurantId={restaurantId}
            catalogs={catalogs}
            onDropBeverage={(beverageId: string) => updateBeverage(beverageId, { catalog_id: catalog.id })}
          />
        ))}

        {(uncategorized.length > 0 || isDragging) && (
          <div 
            className={`space-y-6 p-6 rounded-[2.5rem] transition-all duration-300 ${isDragging ? 'bg-primary/5 border-2 border-dashed border-primary/20' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              const beverageId = e.dataTransfer.getData("beverageId");
              if (beverageId) {
                updateBeverage(beverageId, { catalog_id: null });
                toast.success("Bebida movida para avulsas");
              }
            }}
          >
          <div className="flex items-center gap-4">
             <div className="h-px flex-1 bg-white/10" />
             <h3 className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground">Bebidas sem Catálogo</h3>
             <div className="h-px flex-1 bg-white/10" />
          </div>
          
          <div className="grid gap-4">
            {uncategorized.map(b => (
              <BeverageRowItem
                key={b.id}
                beverage={b}
                onUpdate={(patch: Partial<BeverageRow>) => updateBeverage(b.id, patch)}
                onDelete={() => deleteBeverage(b.id)}
                restaurantId={restaurantId}
                catalogs={catalogs}
                onDragStart={() => setIsDragging(b.id)}
                onDragEnd={() => setIsDragging(null)}
              />
            ))}
          </div>

          <button
              onClick={() => addBeverage()}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" /> Adicionar Bebida Avulsa
            </button>
        </div>

        )}

        {catalogs.length === 0 && uncategorized.length === 0 && !isDragging && (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/5">
             <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="h-8 w-8 text-primary opacity-50" />
             </div>
             <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">Nenhuma bebida ou catálogo cadastrado</p>
             <button onClick={() => setIsAddingCatalog(true)} className="mt-6 text-primary hover:underline font-black text-xs uppercase tracking-widest">Começar Agora →</button>
          </div>
        )}
      </div>

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

function CatalogSection({ catalog, beverages, onUpdateCatalog, onDeleteCatalog, onAddBeverage, onUpdateBeverage, onDeleteBeverage, restaurantId, catalogs, onDropBeverage }: any) {
  const [isOver, setIsOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [local, setLocal] = useState({ ...catalog });

  const handleImageUpload = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${restaurantId}/catalog-${catalog.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload"); return; }
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    onUpdateCatalog({ image_url: pub.publicUrl });
  };

  return (
    <div 
      className={`space-y-6 animate-in fade-in duration-500 p-4 rounded-[2.5rem] transition-all duration-300 ${isOver ? 'bg-primary/5 ring-2 ring-primary/20 ring-dashed' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const beverageId = e.dataTransfer.getData("beverageId");
        if (beverageId) {
          onDropBeverage(beverageId);
          toast.success(`Bebida movida para ${catalog.name}`);
        }
      }}
    >
      <div className="card-premium p-6 border-white/10 bg-white/5 relative group overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
           <button onClick={onDeleteCatalog} className="p-2 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="relative shrink-0">
             {catalog.image_url ? (
               <img src={catalog.image_url} className="h-32 w-48 object-cover rounded-2xl border border-white/10 shadow-xl" />
             ) : (
               <div className="h-32 w-48 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center bg-black/20">
                 <ImageIcon className="h-8 w-8 text-muted-foreground opacity-30" />
               </div>
             )}
             <label className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
                <Upload className="h-4 w-4" />
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
             </label>
          </div>

          <div className="flex-1 space-y-4 w-full">
            <div className="flex items-center justify-between">
              {isEditing ? (
                <input
                  autoFocus
                  value={local.name}
                  onChange={(e) => setLocal({ ...local, name: e.target.value })}
                  onBlur={() => { onUpdateCatalog({ name: local.name }); setIsEditing(false); }}
                  className="text-2xl font-black uppercase tracking-tight bg-transparent border-b border-primary/50 outline-none w-full"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black uppercase tracking-tight">{catalog.name}</h3>
                  <button onClick={() => setIsEditing(true)} className="p-1 text-muted-foreground hover:text-primary"><Edit2 className="h-4 w-4" /></button>
                </div>
              )}
              <div className="flex items-center gap-4">
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Status</span>
                    <button 
                      onClick={() => onUpdateCatalog({ active: !catalog.active })}
                      className={`text-xs font-black uppercase ${catalog.active ? 'text-emerald-400' : 'text-muted-foreground'}`}
                    >
                      {catalog.active ? 'Ativo' : 'Pausado'}
                    </button>
                 </div>
              </div>
            </div>

            <textarea
              value={local.description ?? ""}
              onChange={(e) => setLocal({ ...local, description: e.target.value })}
              onBlur={() => onUpdateCatalog({ description: local.description })}
              placeholder="Descrição do catálogo (opcional)..."
              className="w-full bg-transparent text-sm text-muted-foreground italic resize-none outline-none border-none p-0 focus:ring-0"
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {beverages.map((b: BeverageRow) => (
          <BeverageRowItem
            key={b.id}
            beverage={b}
            onUpdate={(patch) => onUpdateBeverage(b.id, patch)}
            onDelete={() => onDeleteBeverage(b.id)}
            restaurantId={restaurantId}
            catalogs={catalogs}
            onDragStart={() => {}}
            onDragEnd={() => {}}
          />
        ))}
        <button
          onClick={onAddBeverage}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Adicionar Bebida ao Catálogo
        </button>
      </div>
    </div>
  );
}

function BeverageRowItem({ beverage, onUpdate, onDelete, restaurantId, catalogs, onDragStart, onDragEnd }: { 
  beverage: BeverageRow; 
  onUpdate: (patch: Partial<BeverageRow>) => void; 
  onDelete: () => void; 
  restaurantId: string; 
  catalogs: BeverageCatalogRow[];
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {

  const [local, setLocal] = useState({ ...beverage });

  const handleImageUpload = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${restaurantId}/beverage-${beverage.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload"); return; }
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    onUpdate({ image_url: pub.publicUrl });
  };

  const commit = () => {
    if (JSON.stringify(local) === JSON.stringify(beverage)) return;
    onUpdate(local);
  };

  return (
    <div 
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("beverageId", beverage.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={`card-premium p-4 grid grid-cols-1 md:grid-cols-[auto_auto_1fr_auto] gap-4 items-center transition-all hover:border-primary/30 cursor-grab active:cursor-grabbing ${!beverage.is_active ? 'opacity-50 grayscale' : ''}`}
    >
      <div className="hidden md:flex items-center text-muted-foreground/30">
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="relative group shrink-0">
        {beverage.image_url ? (
          <img src={beverage.image_url} className="h-16 w-16 object-cover rounded-xl border border-white/10" />
        ) : (
          <div className="h-16 w-16 rounded-xl border border-dashed border-white/10 bg-black/20 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground opacity-30" />
          </div>
        )}
        <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
           <Upload className="h-4 w-4 text-white" />
           <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4">
        <div className="space-y-1">
           <input
             value={local.name}
             onChange={(e) => setLocal({ ...local, name: e.target.value })}
             onBlur={commit}
             placeholder="Nome da Bebida"
             className="bg-transparent border-none p-0 focus:ring-0 font-bold text-base w-full"
           />
           <input
             value={local.description ?? ""}
             onChange={(e) => setLocal({ ...local, description: e.target.value })}
             onBlur={commit}
             placeholder="Descrição (ex: 350ml, gelada...)"
             className="bg-transparent border-none p-0 focus:ring-0 text-xs text-muted-foreground w-full"
           />
        </div>

        <div className="space-y-1">
           <span className="text-[8px] uppercase font-bold text-muted-foreground block">Preço</span>
           <div className="flex items-center gap-1">
             <span className="text-xs font-black text-primary">R$</span>
             <input
               type="number"
               step="0.01"
               value={local.price}
               onChange={(e) => setLocal({ ...local, price: Number(e.target.value) })}
               onBlur={commit}
               className="bg-transparent border-none p-0 focus:ring-0 font-black text-emerald-400 w-full"
             />
           </div>
        </div>

        <div className="space-y-1">
           <span className="text-[8px] uppercase font-bold text-muted-foreground block">Catálogo</span>
           <select
             value={beverage.catalog_id ?? ""}
             onChange={(e) => onUpdate({ catalog_id: e.target.value || null })}
             className="bg-transparent border-none p-0 focus:ring-0 text-xs font-bold w-full appearance-none"
           >
             <option value="">Sem Catálogo</option>
             {catalogs?.map((c: any) => (
               <option key={c.id} value={c.id}>{c.name}</option>
             ))}
           </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {beverage.catalog_id && (
          <button
            onClick={() => onUpdate({ catalog_id: null })}
            className="md:hidden flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase tracking-widest transition-all"
            title="Remover do Catálogo"
          >
            Remover
          </button>
        )}
        <button
          onClick={() => onUpdate({ is_active: !beverage.is_active })}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${beverage.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-white/5 text-muted-foreground'}`}
        >
          {beverage.is_active ? 'Ativo' : 'Inativo'}
        </button>
        <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
