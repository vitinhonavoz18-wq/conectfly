import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ComboGroupRow, ComboRow } from "@/lib/site/types";

interface Props {
  restaurantId: string;
}

export function ComboManager({ restaurantId }: Props) {
  const [groups, setGroups] = useState<ComboGroupRow[]>([]);
  const [combos, setCombos] = useState<ComboRow[]>([]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const reload = async () => {
    const [g, c] = await Promise.all([
      supabase
        .from("combo_groups")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
      supabase
        .from("combos")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
    ]);
    setGroups((g.data ?? []) as unknown as ComboGroupRow[]);
    setCombos((c.data ?? []) as unknown as ComboRow[]);
  };

  useEffect(() => {
    reload();
  }, [restaurantId]);

  const addGroup = async () => {
    const title = prompt("Título do grupo (ex: Combos 500g)")?.trim();
    if (!title) return;
    await supabase.from("combo_groups").insert({
      restaurant_id: restaurantId,
      title,
      sort_order: groups.length,
    });
    reload();
  };

  const removeGroup = async (id: string) => {
    if (!confirm("Excluir este grupo e todos os combos dele?")) return;
    await supabase.from("combo_groups").delete().eq("id", id);
    reload();
  };

  const addCombo = async (groupId: string) => {
    await supabase.from("combos").insert({
      restaurant_id: restaurantId,
      group_id: groupId,
      name: "Novo combo",
      items: [],
      price: 0,
      sort_order: combos.filter((c) => c.group_id === groupId).length,
    });
    reload();
  };

  const updateCombo = async (id: string, patch: Partial<ComboRow>) => {
    await supabase.from("combos").update(patch).eq("id", id);
    setCombos((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCombo = async (id: string) => {
    await supabase.from("combos").delete().eq("id", id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Combos promocionais. Cada combo lista os itens inclusos — eles aparecem
          na mensagem do WhatsApp para o cliente saber tudo que vem no pedido.
        </p>
        <button
          onClick={addGroup}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo grupo
        </button>
      </div>

      {groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          Nenhum grupo de combos ainda.
        </div>
      )}

      {groups.map((g) => {
        const isOpen = openGroup === g.id;
        const cs = combos.filter((c) => c.group_id === g.id);
        return (
          <div key={g.id} className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between p-3">
              <button
                onClick={() => setOpenGroup(isOpen ? null : g.id)}
                className="flex items-center gap-2 font-bold flex-1 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {g.title}
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  ({cs.length})
                </span>
              </button>
              <button
                onClick={() => removeGroup(g.id)}
                className="p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {isOpen && (
              <div className="border-t border-border p-3 space-y-3">
                {cs.map((c) => (
                  <ComboRowEditor
                    key={c.id}
                    combo={c}
                    onUpdate={(p) => updateCombo(c.id, p)}
                    onRemove={() => removeCombo(c.id)}
                  />
                ))}
                <button
                  onClick={() => addCombo(g.id)}
                  className="w-full py-2 rounded-lg border border-dashed border-border hover:border-accent text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Adicionar combo
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ComboRowEditor({
  combo,
  onUpdate,
  onRemove,
}: {
  combo: ComboRow;
  onUpdate: (p: Partial<ComboRow>) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(combo.name);
  const [price, setPrice] = useState(String(combo.price));
  const [badge, setBadge] = useState(combo.badge ?? "");
  const [itemsText, setItemsText] = useState(combo.items.join("\n"));

  const commit = () => {
    const items = itemsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    onUpdate({
      name: name.trim() || "Sem nome",
      price: Number(price) || 0,
      badge: badge.trim() || null,
      items,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3 grid gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_120px_auto] gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          placeholder="Nome do combo"
          className="input"
        />
        <input
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
          onBlur={commit}
          placeholder="Badge (opcional)"
          className="input"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commit}
          placeholder="0.00"
          inputMode="decimal"
          className="input"
        />
        <button
          onClick={onRemove}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={itemsText}
        onChange={(e) => setItemsText(e.target.value)}
        onBlur={commit}
        rows={3}
        placeholder={"Itens inclusos — uma linha por item:\nYakisoba camarão, carne e frango\n3 rolinhos primavera\nRefrigerante 1L"}
        className="input resize-none text-xs"
      />
    </div>
  );
}