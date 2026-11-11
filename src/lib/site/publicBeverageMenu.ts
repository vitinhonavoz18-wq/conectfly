import type { BeverageRow, SiteData } from "./types";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function beverageKey(name: string, size: string | null, price: number) {
  const label = name.replace(/^\[[^\]]+\]\s*/, "");
  return JSON.stringify([normalized(label), normalized(size ?? ""), Number(price)]);
}

/** Junta os dois cadastros apenas na vitrine. O painel continua editando cada registro de origem. */
export function publicBeverageMenu(data: SiteData): SiteData {
  const visible = data.restaurant.site_settings?.beverages_visibility !== false;
  const beverages = visible ? [...(data.beverages ?? [])] : [];
  const keys = new Set(beverages.map(b => beverageKey(b.name, b.size, b.price)));
  const categories = data.categories.filter(category => {
    if (category.is_pizza || (category.type?.toUpperCase() !== "BEVERAGE" &&
        !/^(?:bebidas?|beverages?|drinks?|refrigerantes?|cervejas?|vinhos?|cocktails?|catalogo de bebidas)$/.test(normalized(category.name)))) return true;
    if (!visible || category.is_active === false || category.show_on_public_site === false || category.allow_cart_addition === false) return false;
    for (const item of category.items) {
      if (item.is_active === false) continue;
      const sizes = item.sizes?.length ? item.sizes : [{ label: "", price: item.price }];
      for (const [index, variant] of sizes.entries()) {
        const key = beverageKey(item.name, variant.label, variant.price);
        if (keys.has(key)) continue;
        keys.add(key);
        const name = item.name.replace(/^\[[^\]]+\]\s*/, "");
        const drink: BeverageRow = {
          id: variant.label ? `${item.id}-size-${index}` : item.id,
          name: variant.label ? `${name} — ${variant.label}` : name,
          pizzeria_id: category.restaurant_id, price: Number(variant.price),
          description: item.description, image_url: item.image_url ?? null,
          brand: null, size: variant.label || null, category: category.name,
          is_active: true, sort_order: item.sort_order,
        };
        beverages.push(drink);
      }
    }
    return false;
  });
  return { ...data, categories, beverages };
}
