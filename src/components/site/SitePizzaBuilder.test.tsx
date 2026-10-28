import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MenuCategoryRow, MenuItemRow, RestaurantRow } from "@/lib/site/types";

vi.mock("./CartContext", () => ({
  useCart: () => ({ addLine: vi.fn(), replaceLine: vi.fn(), setCartOpen: vi.fn() }),
}));
vi.mock("./SiteBeverageSection", () => ({ SiteBeverageSection: () => null }));

const { SitePizzaBuilder } = await import("./SitePizzaBuilder");

function item(id: string, name: string, extra: Partial<MenuItemRow> = {}): MenuItemRow {
  return {
    id,
    name,
    category_id: "cat",
    restaurant_id: "r",
    description: null,
    price: 0,
    sizes: null,
    sort_order: 0,
    is_special: false,
    special_extra: 0,
    ...extra,
  };
}

const categoria = {
  id: "cat",
  name: "Pizzas",
  is_pizza: true,
  pizza_sizes: [
    { label: "Média", price: 40, max_flavors: 2 },
    { label: "Grande", price: 50, max_flavors: 3 },
  ],
  items: [
    item("cal", "Calabresa", { pizza_size_prices_cents: { media: 4200, grande: 5200 } }),
    item("cam", "Camarão", { is_special: true, special_extra: 15 }),
  ],
} as unknown as MenuCategoryRow & { items: MenuItemRow[] };

const bordas = {
  id: "b",
  name: "Bordas",
  items: [item("cat", "Catupiry", { price: 8 })],
} as unknown as MenuCategoryRow & { items: MenuItemRow[] };

function desenhar(siteSettings: Record<string, unknown> | undefined) {
  const restaurant = { id: "r", site_settings: siteSettings, show_item_images: false } as unknown as RestaurantRow;
  return renderToStaticMarkup(
    <SitePizzaBuilder category={categoria} restaurant={restaurant} bordasCategory={bordas} />,
  );
}

describe("tela de montar pizza", () => {
  it("20. loja sem configuração nova: mesma tela de antes (borda opcional, preço por tamanho)", () => {
    const html = desenhar(undefined);
    expect(html).toContain("Sem Borda");
    expect(html).toContain("(opcional)");
    expect(html).toContain("preço por tamanho");
    expect(html).toContain("+R$");
    // Ainda sem sabor: o botão começa desabilitado.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Adicionar ao Pedido/s);
  });

  it("2/7. regra do maior preço: mostra o preço de cada sabor no tamanho e explica a regra", () => {
    const html = desenhar({ pizza_premium: { regra: "maior_preco" } });
    expect(html).toContain("sabor mais caro");
    expect(html).toContain("R$ 42,00"); // Calabresa na Média
    expect(html).toContain("R$ 55,00"); // Camarão sem preço próprio: Média 40 + especial 15
  });

  it("4. borda obrigatória: some a opção “Sem Borda”", () => {
    const html = desenhar({ pizza_premium: { bordaObrigatoria: true } });
    expect(html).toContain("(obrigatório)");
    expect(html).not.toContain("Sem Borda");
  });
});
