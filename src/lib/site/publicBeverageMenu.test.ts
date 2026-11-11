import { describe, expect, it } from "vitest";
import { publicBeverageMenu } from "./publicBeverageMenu";
import type { SiteData } from "./types";

const data = {
  restaurant: { site_settings: {} },
  categories: [
    { name: "BEBIDAS", items: [
      { id: "legacy-water", name: "[agua] Água", price: 5 },
      { id: "juice", name: "Suco", sizes: [{ label: "300 ml", price: 8 }, { label: "500 ml", price: 12 }] },
      { id: "hidden", name: "Indisponível", is_active: false },
    ] },
    { name: "Combo com bebida", items: [] },
  ],
  beverages: [{ id: "official", name: "Água", price: 5, size: null }],
} as unknown as SiteData;

describe("bebidas do cardápio público", () => {
  it("reúne os cadastros, mantém tamanhos e preços e prioriza o registro da aba", () => {
    const menu = publicBeverageMenu(data);
    expect(menu.categories.map(c => c.name)).toEqual(["Combo com bebida"]);
    expect(menu.beverages?.map(b => [b.id, b.price])).toEqual([
      ["official", 5], ["juice-size-0", 8], ["juice-size-1", 12],
    ]);
    expect(data.categories).toHaveLength(2);
  });
  it("respeita a seção desativada e categorias ocultas", () => {
    expect(publicBeverageMenu({ ...data, restaurant: { ...data.restaurant, site_settings: { beverages_visibility: false } } }).beverages).toEqual([]);
    expect(publicBeverageMenu({ ...data, categories: data.categories.map(c => ({ ...c, show_on_public_site: false })) }).beverages).toEqual(data.beverages);
  });
});
