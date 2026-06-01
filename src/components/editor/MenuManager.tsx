import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Upload, ImageIcon, Sparkles, ShoppingBag, FileJson, Settings2, Eye, EyeOff, LayoutGrid, List, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { MenuCategoryRow, MenuItemRow, PizzaSize, Size, RestaurantRow } from "@/lib/site/types";
import { seedDefaultMenu } from "@/lib/site/defaultMenu";

import { MenuImport } from "./MenuImport";
import { adminFetchSiteData, updateRestaurant } from "@/lib/site/queries";
import { formatBRL } from "@/lib/site/format";

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
      const categories = (data.categories as unknown as MenuCategoryRow[]).filter(c => {
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
                    <ItemRow key={it.id} item={it} onUpdate={(p) => updateItem(it.id, p)} onRemove={() => removeItem(it.id)} />
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

function ItemRow({ item, onUpdate, onRemove }: { item: MenuItemRow; onUpdate: (p: Partial<MenuItemRow>) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
      <input value={item.name} onChange={(e) => onUpdate({ name: e.target.value })} className="bg-transparent border-none focus:ring-0 font-bold flex-1" />
      <div className="flex items-center gap-1 w-24">
        <span className="text-xs text-primary font-bold">R$</span>
        <input type="number" step="0.01" value={item.price} onChange={(e) => onUpdate({ price: Number(e.target.value) })} className="bg-transparent border-none focus:ring-0 font-black text-emerald-400 w-full" />
      </div>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
