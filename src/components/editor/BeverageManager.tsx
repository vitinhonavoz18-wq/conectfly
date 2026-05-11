import { useEffect, useState } from "react";
import { Plus, Trash2, Save, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { BeverageRow } from "@/lib/site/types";

interface Props {
  restaurantId: string;
}

export function BeverageManager({ restaurantId }: Props) {
  const [beverages, setBeverages] = useState<BeverageRow[]>([]);
  const [loading, setLoading] = useState(true);

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
      }
    } catch (err) {
      console.error("Caught error loading beverages:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, [restaurantId]);

  const addBeverage = async () => {
    const { error } = await supabase.from("pizzeria_beverages").insert({
      pizzeria_id: restaurantId,
      name: "Nova Bebida",
      brand: "",
      size: "",
      price: 0,
      sort_order: beverages.length,
    });
    if (error) alert("Erro ao adicionar: " + error.message);
    else reload();
  };

  const updateBeverage = async (id: string, patch: Partial<BeverageRow>) => {
    const { error } = await supabase
      .from("pizzeria_beverages")
      .update(patch as any)
      .eq("id", id);
    
    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setBeverages((cur) => cur.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    }
  };

  const removeBeverage = async (id: string) => {
    if (!confirm("Excluir esta bebida?")) return;
    const { error } = await supabase.from("pizzeria_beverages").delete().eq("id", id);
    if (error) alert("Erro ao excluir: " + error.message);
    else reload();
  };

  if (loading) return <div className="p-4 text-center">Carregando bebidas...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">Bebidas</h3>
        </div>
        <button
          onClick={addBeverage}
          className="btn-premium px-4 py-2 rounded-xl flex items-center gap-2 text-xs uppercase tracking-widest shadow-lg"
        >
          <Plus className="h-4 w-4" /> Adicionar Bebida
        </button>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BeverageItemRow({
  beverage,
  onUpdate,
  onRemove,
}: {
  beverage: BeverageRow;
  onUpdate: (patch: Partial<BeverageRow>) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState({ ...beverage });

  const commit = () => {
    if (JSON.stringify(local) === JSON.stringify(beverage)) return;
    onUpdate(local);
  };

  return (
    <div className={`card-premium p-4 grid grid-cols-1 md:grid-cols-[1fr_150px_120px_100px_auto] gap-4 items-center transition-opacity ${!local.is_active ? 'opacity-50' : ''}`}>
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
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Marca</label>
        <input
          value={local.brand ?? ""}
          onChange={(e) => setLocal({ ...local, brand: e.target.value })}
          onBlur={commit}
          className="input bg-black/20 border-white/5 focus:border-primary/40 text-sm"
          placeholder="Ex: Coca-Cola Co."
        />
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
        <input
          type="number"
          step="0.01"
          value={local.price}
          onChange={(e) => setLocal({ ...local, price: Number(e.target.value) })}
          onBlur={commit}
          className="input bg-black/20 border-white/5 focus:border-primary/40 font-black text-emerald-400"
          placeholder="0.00"
        />
      </div>

      <div className="flex items-center gap-2 pt-5">
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