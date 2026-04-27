import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Upload, ImageIcon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { MenuCategoryRow, MenuItemRow, PizzaSize, Size } from "@/lib/site/types";
import { seedDefaultMenu } from "@/lib/site/defaultMenu";

interface Props {
  restaurantId: string;
}

export function MenuManager({ restaurantId }: Props) {
  const [cats, setCats] = useState<MenuCategoryRow[]>([]);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

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
    await supabase
      .from("menu_categories")
      .update(patch as never)
      .eq("id", id);
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

  const applyDefaultMenu = async () => {
    const hasContent = cats.length > 0 || items.length > 0;
    const msg = hasContent
      ? "Isso vai SUBSTITUIR todo o cardápio atual pelo cardápio padrão (PIZZA com 4 tamanhos e 32 sabores). Continuar?"
      : "Carregar o cardápio padrão (PIZZA com 4 tamanhos e 32 sabores)?";
    if (!confirm(msg)) return;
    setLoadingTemplate(true);
    const res = await seedDefaultMenu(restaurantId, { force: true });
    setLoadingTemplate(false);
    if (!res.inserted) {
      alert("Falha ao carregar cardápio padrão: " + (res.reason ?? "erro desconhecido"));
      return;
    }
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Organize seu cardápio em categorias. Use tamanhos para itens com preço variável (ex: 500g / 1kg).
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={applyDefaultMenu}
            disabled={loadingTemplate}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-primary text-sm font-semibold disabled:opacity-50"
            title="Carregar cardápio padrão (Pizzaria — 4 tamanhos e 32 sabores)"
          >
            <Sparkles className="h-4 w-4" />
            {loadingTemplate ? "Carregando..." : "Cardápio padrão"}
          </button>
          <button
            onClick={addCategory}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nova categoria
          </button>
        </div>
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
            <div className="px-3 pb-3 -mt-1">
              <PizzaSettings category={c} onUpdate={(p) => updateCategory(c.id, p)} />
            </div>
            {isOpen && (
              <div className="border-t border-border p-3 space-y-3">
                {c.is_pizza && (
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-muted-foreground">
                    🍕 Categoria <strong>pizza</strong>: o preço vem do <strong>tamanho</strong>.
                    Cadastre apenas o nome e descrição de cada <strong>sabor</strong> abaixo — o
                    campo de preço dos sabores é ignorado.
                  </div>
                )}
                {its.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    hidePrice={c.is_pizza}
                    onUpdate={(p) => updateItem(it.id, p)}
                    onRemove={() => removeItem(it.id)}
                  />
                ))}
                <button
                  onClick={() => addItem(c.id)}
                  className="w-full py-2 rounded-lg border border-dashed border-border hover:border-primary text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
                >
                  <Plus className="h-4 w-4" /> {c.is_pizza ? "Adicionar sabor" : "Adicionar item"}
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
  hidePrice = false,
  onUpdate,
  onRemove,
}: {
  item: MenuItemRow;
  hidePrice?: boolean;
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
  const [isSpecial, setIsSpecial] = useState<boolean>(item.is_special ?? false);
  const [specialExtra, setSpecialExtra] = useState<string>(
    String(item.special_extra ?? 0),
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
      is_special: isSpecial,
      special_extra: Number(specialExtra) || 0,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3 grid gap-2">
      <div
        className={`grid grid-cols-1 ${
          hidePrice ? "sm:grid-cols-[1fr_auto]" : "sm:grid-cols-[1fr_120px_auto]"
        } gap-2`}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          placeholder={hidePrice ? "Nome do sabor" : "Nome do item"}
          className="input"
        />
        {!hidePrice && (
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commit}
            placeholder="0.00"
            inputMode="decimal"
            className="input"
          />
        )}
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
      {hidePrice && (
        <div className="flex items-center gap-3 flex-wrap rounded-md bg-muted/40 border border-dashed border-border p-2">
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSpecial}
              onChange={(e) => {
                setIsSpecial(e.target.checked);
                onUpdate({
                  is_special: e.target.checked,
                  special_extra: Number(specialExtra) || 0,
                });
              }}
              className="h-4 w-4 accent-primary"
            />
            <span>✨ Sabor especial (acréscimo no preço final)</span>
          </label>
          {isSpecial && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">+ R$</span>
              <input
                value={specialExtra}
                onChange={(e) => setSpecialExtra(e.target.value)}
                onBlur={commit}
                placeholder="5.00"
                inputMode="decimal"
                className="input h-8 w-24"
              />
            </div>
          )}
        </div>
      )}
      {!hidePrice && (
        <textarea
          value={sizesText}
          onChange={(e) => setSizesText(e.target.value)}
          onBlur={commit}
          rows={2}
          placeholder={"Tamanhos opcionais — uma linha por tamanho:\n500g|35\n1kg|55"}
          className="input resize-none text-xs font-mono"
        />
      )}
    </div>
  );
}

const DEFAULT_PIZZA_SIZES: PizzaSize[] = [
  { label: "Pequena", price: 0, max_flavors: 1 },
  { label: "Média", price: 0, max_flavors: 2 },
  { label: "Grande", price: 0, max_flavors: 3 },
  { label: "Família", price: 0, max_flavors: 4 },
];

function PizzaSettings({
  category,
  onUpdate,
}: {
  category: MenuCategoryRow;
  onUpdate: (p: Partial<MenuCategoryRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const sizes: PizzaSize[] =
    category.pizza_sizes && category.pizza_sizes.length > 0
      ? category.pizza_sizes
      : DEFAULT_PIZZA_SIZES;

  const togglePizza = (checked: boolean) => {
    onUpdate({
      is_pizza: checked,
      pizza_sizes: checked
        ? category.pizza_sizes && category.pizza_sizes.length > 0
          ? category.pizza_sizes
          : DEFAULT_PIZZA_SIZES
        : category.pizza_sizes,
    });
    if (checked) setOpen(true);
  };

  const updateSize = (idx: number, patch: Partial<PizzaSize>) => {
    const next = sizes.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onUpdate({ pizza_sizes: next });
  };

  const addSize = () => {
    const next = [...sizes, { label: "Novo tamanho", price: 0, max_flavors: 1 }];
    onUpdate({ pizza_sizes: next });
  };

  const removeSize = (idx: number) => {
    const next = sizes.filter((_, i) => i !== idx);
    onUpdate({ pizza_sizes: next.length > 0 ? next : null });
  };

  return (
    <div className="rounded-lg border border-border bg-background/40">
      <div className="flex items-center justify-between gap-2 p-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={category.is_pizza}
            onChange={(e) => togglePizza(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>🍕 Categoria de pizza (preço por tamanho, sabores selecionáveis)</span>
        </label>
        {category.is_pizza && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {open ? "Ocultar tamanhos" : "Editar tamanhos"}
          </button>
        )}
      </div>
      {category.is_pizza && open && (
        <div className="border-t border-border p-3 space-y-2">
          <div className="grid grid-cols-[1fr_100px_120px_auto] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground px-1">
            <span>Tamanho</span>
            <span>Preço (R$)</span>
            <span>Máx. sabores</span>
            <span></span>
          </div>
          {sizes.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_120px_auto] gap-2">
              <input
                value={s.label}
                onChange={(e) => updateSize(i, { label: e.target.value })}
                className="input"
                placeholder="Pequena"
              />
              <input
                value={String(s.price)}
                onChange={(e) => updateSize(i, { price: Number(e.target.value) || 0 })}
                className="input"
                inputMode="decimal"
                placeholder="0.00"
              />
              <input
                value={String(s.max_flavors)}
                onChange={(e) =>
                  updateSize(i, { max_flavors: Math.max(1, Number(e.target.value) || 1) })
                }
                className="input"
                inputMode="numeric"
                placeholder="1"
              />
              <button
                onClick={() => removeSize(i)}
                className="p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addSize}
            className="w-full py-2 rounded-lg border border-dashed border-border hover:border-primary text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
          >
            <Plus className="h-3 w-3" /> Adicionar tamanho
          </button>
        </div>
      )}
    </div>
  );
}