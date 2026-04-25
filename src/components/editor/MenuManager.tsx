import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Upload, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { MenuCategoryRow, MenuItemRow, Size } from "@/lib/site/types";

interface Props {
  restaurantId: string;
}

export function MenuManager({ restaurantId }: Props) {
  const [cats, setCats] = useState<MenuCategoryRow[]>([]);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [openCat, setOpenCat] = useState<string | null>(null);

  const reload = async () => {
    const [c, i] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
      supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
    ]);
    setCats((c.data ?? []) as unknown as MenuCategoryRow[]);
    setItems((i.data ?? []) as unknown as MenuItemRow[]);
  };

  useEffect(() => {
    reload();
  }, [restaurantId]);

  const addCategory = async () => {
    const name = prompt("Nome da categoria (ex: Yakisoba)")?.trim();
    if (!name) return;
    const icon = prompt("Emoji/ícone (opcional, ex: 🍜)")?.trim() || null;
    await supabase.from("menu_categories").insert({
      restaurant_id: restaurantId,
      name,
      icon,
      sort_order: cats.length,
    });
    reload();
  };

  const removeCategory = async (id: string) => {
    if (!confirm("Excluir esta categoria e todos os itens dela?")) return;
    await supabase.from("menu_categories").delete().eq("id", id);
    reload();
  };

  const updateCategory = async (id: string, patch: Partial<MenuCategoryRow>) => {
    await supabase.from("menu_categories").update(patch).eq("id", id);
    setCats((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleCategoryImageUpload = async (categoryId: string, file: File) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${restaurantId}/category-${categoryId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      alert("Erro no upload: " + error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    await updateCategory(categoryId, { image_url: pub.publicUrl });
  };

  const addItem = async (categoryId: string) => {
    await supabase.from("menu_items").insert({
      restaurant_id: restaurantId,
      category_id: categoryId,
      name: "Novo item",
      description: "",
      price: 0,
      sort_order: items.filter((i) => i.category_id === categoryId).length,
    });
    reload();
  };

  const updateItem = async (id: string, patch: Partial<MenuItemRow>) => {
    await supabase.from("menu_items").update(patch).eq("id", id);
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const removeItem = async (id: string) => {
    await supabase.from("menu_items").delete().eq("id", id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Organize seu cardápio em categorias. Use tamanhos para itens com preço variável (ex: 500g / 1kg).
        </p>
        <button
          onClick={addCategory}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova categoria
        </button>
      </div>

      {cats.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          Nenhuma categoria ainda. Crie a primeira para começar.
        </div>
      )}

      {cats.map((c) => {
        const isOpen = openCat === c.id;
        const its = items.filter((i) => i.category_id === c.id);
        return (
          <div key={c.id} className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative shrink-0">
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      className="h-14 w-14 object-cover rounded-lg border border-border bg-muted"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <label
                    title="Enviar imagem da categoria"
                    className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center cursor-pointer shadow-glow hover:opacity-90"
                  >
                    <Upload className="h-3 w-3" />
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleCategoryImageUpload(c.id, f);
                      }}
                    />
                  </label>
                </div>
                <button
                  onClick={() => setOpenCat(isOpen ? null : c.id)}
                  className="flex items-center gap-2 font-bold flex-1 text-left min-w-0"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal ml-2 shrink-0">
                    ({its.length} {its.length === 1 ? "item" : "itens"})
                  </span>
                </button>
              </div>
              <button
                onClick={() => removeCategory(c.id)}
                className="p-2 text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {!c.image_url && (
              <div className="px-3 pb-2 -mt-1">
                <p className="text-xs text-muted-foreground">
                  ⚠️ Adicione uma imagem para exibir como destaque da categoria no site.
                </p>
              </div>
            )}
            {isOpen && (
              <div className="border-t border-border p-3 space-y-3">
                {its.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    onUpdate={(p) => updateItem(it.id, p)}
                    onRemove={() => removeItem(it.id)}
                  />
                ))}
                <button
                  onClick={() => addItem(c.id)}
                  className="w-full py-2 rounded-lg border border-dashed border-border hover:border-primary text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Adicionar item
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: MenuItemRow;
  onUpdate: (p: Partial<MenuItemRow>) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [desc, setDesc] = useState(item.description ?? "");
  const [price, setPrice] = useState(String(item.price));
  const [sizesText, setSizesText] = useState(
    item.sizes && item.sizes.length > 0
      ? item.sizes.map((s) => `${s.label}|${s.price}`).join("\n")
      : "",
  );

  const commit = () => {
    const sizes: Size[] = sizesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [label, p] = l.split("|");
        return { label: (label ?? "").trim(), price: Number(p) || 0 };
      })
      .filter((s) => s.label);

    onUpdate({
      name: name.trim() || "Sem nome",
      description: desc,
      price: Number(price) || 0,
      sizes: sizes.length > 0 ? sizes : null,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3 grid gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          placeholder="Nome do item"
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
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={commit}
        rows={2}
        placeholder="Descrição (opcional)"
        className="input resize-none text-sm"
      />
      <textarea
        value={sizesText}
        onChange={(e) => setSizesText(e.target.value)}
        onBlur={commit}
        rows={2}
        placeholder={"Tamanhos opcionais — uma linha por tamanho:\n500g|35\n1kg|55"}
        className="input resize-none text-xs font-mono"
      />
    </div>
  );
}