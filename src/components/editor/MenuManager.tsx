import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Upload, ImageIcon, Sparkles, ShoppingBag, FileJson, Settings2, Eye, EyeOff, LayoutGrid, List, ChevronUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MenuCategoryRow, MenuItemRow, PizzaSize, Size, RestaurantRow } from "@/lib/site/types";
import { seedDefaultMenu } from "@/lib/site/defaultMenu";

import { MenuImport } from "./MenuImport";
import { MenuSyncDebug } from "./MenuSyncDebug";
import { adminFetchSiteData, updateRestaurant } from "@/lib/site/queries";
import { formatBRL } from "@/lib/site/format";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function uploadMenuImage(file: File, restaurantId: string, prefix: string, id: string): Promise<string | null> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
    return null;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast.error("Imagem muito grande. Máximo 10MB.");
    return null;
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${restaurantId}/${prefix}-${id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type });
  if (error) { toast.error("Erro no upload: " + error.message); return null; }
  const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
  return pub.publicUrl;
}

interface Props {
  restaurantId: string;
}

export function MenuManager({ restaurantId }: Props) {
  const [cats, setCats] = useState<MenuCategoryRow[]>([]);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const reload = async () => {
    try {
      const data = await adminFetchSiteData(restaurantId);
      const categories = (data.categories as any[]).filter(c => {
        const name = c.name.toLowerCase();
        const isBev = name.includes("bebida") || 
                      name.includes("beverage") || 
                      name.includes("drink") || 
                      c.type === 'beverage';
        return !isBev;
      });
      
      setCats(categories);
      const allItems: MenuItemRow[] = [];
      categories.forEach(cat => {
        if (cat.items) allItems.push(...(cat.items as MenuItemRow[]));
      });
      setItems(allItems);
      setRestaurant(data.restaurant);
    } catch (err) {
      console.error("[MenuManager] Falha ao recarregar:", err);
    }
  };

  useEffect(() => {
    reload();
  }, [restaurantId]);

  const addCategory = async () => {
    const name = prompt("Nome da categoria")?.trim();
    if (!name) return;
    await supabase.from("menu_categories").insert({
      restaurant_id: restaurantId,
      name,
      sort_order: cats.length,
    });
    reload();
  };

  const removeCategory = async (id: string) => {
    if (!confirm("Excluir esta categoria?")) return;
    await supabase.from("menu_categories").delete().eq("id", id);
    reload();
  };

  const updateCategory = async (id: string, patch: Partial<MenuCategoryRow>) => {
    await supabase.from("menu_categories").update(patch as any).eq("id", id);
    setCats((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addItem = async (categoryId: string) => {
    await supabase.from("menu_items").insert({
      restaurant_id: restaurantId,
      category_id: categoryId,
      name: "Novo item",
      price: 0,
      sort_order: items.filter((i) => i.category_id === categoryId).length,
    });
    reload();
  };

  const updateItem = async (id: string, patch: Partial<MenuItemRow>) => {
    await supabase.from("menu_items").update(patch as any).eq("id", id);
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const removeItem = async (id: string) => {
    await supabase.from("menu_items").delete().eq("id", id);
    reload();
  };

  return (
    <div className="space-y-12">
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black uppercase tracking-widest text-primary">Outras Categorias</h3>
          <div className="flex gap-2">
            <MenuSyncDebug restaurantId={restaurantId} />
            <MenuImport restaurantId={restaurantId} onSuccess={reload} />
            <button onClick={addCategory} className="btn-premium px-6 py-2.5 rounded-xl flex items-center gap-2 text-xs uppercase tracking-widest">
              <Plus className="h-4 w-4" /> Nova Categoria
            </button>
          </div>
        </div>

        {cats.map((c) => (
          <div key={c.id} className="card-premium overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <CategoryImageThumb
                  category={c}
                  restaurantId={restaurantId}
                  onUpdate={(p) => updateCategory(c.id, p)}
                />
                <button onClick={() => setOpenCat(openCat === c.id ? null : c.id)} className="flex items-center gap-3 font-bold text-lg">
                  {openCat === c.id ? <ChevronDown /> : <ChevronRight />}
                  {c.name}
                </button>
              </div>
              <button onClick={() => removeCategory(c.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-5 w-5" /></button>
            </div>
            {openCat === c.id && (
              <div className="p-4 border-t border-white/5 space-y-4">
                <CatalogSettingsLocal category={c} onUpdate={(p) => updateCategory(c.id, p)} />
                <div className="grid gap-2">
                  {items.filter(i => i.category_id === c.id).map(it => (
                    <ItemRow key={it.id} item={it} restaurantId={restaurantId} onUpdate={(p) => updateItem(it.id, p)} onRemove={() => removeItem(it.id)} />
                  ))}
                  <button onClick={() => addItem(c.id)} className="w-full py-3 border-2 border-dashed border-white/5 rounded-xl text-sm font-bold hover:border-primary/30 transition-all">
                    + Adicionar Item
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogSettingsLocal({ category, onUpdate }: { category: MenuCategoryRow; onUpdate: (p: Partial<MenuCategoryRow>) => void }) {
  return (
    <div className="flex items-center gap-6 bg-white/5 p-3 rounded-xl border border-white/5">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={category.show_on_public_site !== false} onChange={(e) => onUpdate({ show_on_public_site: e.target.checked })} className="accent-primary" />
        <span className="text-[10px] font-black uppercase">Público</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={category.show_directly_in_menu !== false} onChange={(e) => onUpdate({ show_directly_in_menu: e.target.checked })} className="accent-primary" />
        <span className="text-[10px] font-black uppercase">Direto</span>
      </label>
    </div>
  );
}

function CategoryImageThumb({ category, restaurantId, onUpdate }: { category: MenuCategoryRow; restaurantId: string; onUpdate: (p: Partial<MenuCategoryRow>) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const handle = async (file?: File | null) => {
    if (!file) return;
    const url = await uploadMenuImage(file, restaurantId, `category-${category.id}`, category.id);
    if (url) { onUpdate({ image_url: url }); toast.success("Imagem da categoria atualizada"); }
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files?.[0]); }}
      className={`relative h-14 w-14 shrink-0 rounded-xl border ${dragOver ? "border-primary" : "border-white/10"} bg-black/20 overflow-hidden group`}
      title="Arraste uma imagem ou clique para enviar"
    >
      {category.image_url ? (
        <img src={category.image_url} alt={category.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground opacity-40" /></div>
      )}
      <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
        <Upload className="h-4 w-4 text-white" />
        <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" hidden onChange={(e) => handle(e.target.files?.[0])} />
      </label>
      {category.image_url && (
        <button
          onClick={(e) => { e.stopPropagation(); onUpdate({ image_url: null as any }); }}
          className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/70 text-white hidden group-hover:flex items-center justify-center"
          title="Remover imagem"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function ItemImageThumb({ item, restaurantId, onUpdate }: { item: MenuItemRow; restaurantId: string; onUpdate: (p: Partial<MenuItemRow>) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const handle = async (file?: File | null) => {
    if (!file) return;
    const url = await uploadMenuImage(file, restaurantId, `item-${item.id}`, item.id);
    if (url) { onUpdate({ image_url: url }); toast.success("Imagem do produto atualizada"); }
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files?.[0]); }}
      className={`relative h-12 w-12 shrink-0 rounded-lg border ${dragOver ? "border-primary" : "border-white/10"} bg-black/20 overflow-hidden group`}
      title="Arraste uma imagem ou clique para enviar"
    >
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground opacity-40" /></div>
      )}
      <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
        <Upload className="h-3.5 w-3.5 text-white" />
        <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" hidden onChange={(e) => handle(e.target.files?.[0])} />
      </label>
      {item.image_url && (
        <button
          onClick={(e) => { e.stopPropagation(); onUpdate({ image_url: null as any }); }}
          className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/70 text-white hidden group-hover:flex items-center justify-center"
          title="Remover imagem"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function ItemRow({ item, restaurantId, onUpdate, onRemove }: { item: MenuItemRow; restaurantId: string; onUpdate: (p: Partial<MenuItemRow>) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
      <ItemImageThumb item={item} restaurantId={restaurantId} onUpdate={onUpdate} />
      <input value={item.name} onChange={(e) => onUpdate({ name: e.target.value })} className="bg-transparent border-none focus:ring-0 font-bold flex-1" />
      <div className="flex items-center gap-1 w-24">
        <span className="text-xs text-primary font-bold">R$</span>
        <input type="number" step="0.01" value={item.price} onChange={(e) => onUpdate({ price: Number(e.target.value) })} className="bg-transparent border-none focus:ring-0 font-black text-emerald-400 w-full" />
      </div>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
