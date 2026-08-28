import { describe, expect, it } from "vitest";
import { MINIMO_PARA_BUSCAR, buscarNoCardapio, destaquesDoCardapio } from "./buscaNoCardapio";
import type { MenuCategoryRow, MenuItemRow } from "./types";

function item(over: Partial<MenuItemRow> & { name: string }): MenuItemRow {
  return {
    id: over.name,
    category_id: "c1",
    restaurant_id: "r1",
    description: null,
    price: 10,
    sizes: null,
    sort_order: 0,
    is_special: false,
    special_extra: 0,
    ...over,
  } as MenuItemRow;
}

function categoria(nome: string, itens: MenuItemRow[]) {
  return {
    id: nome,
    restaurant_id: "r1",
    name: nome,
    description: null,
    icon: null,
    items: itens,
  } as unknown as MenuCategoryRow & { items: MenuItemRow[] };
}

const CARDAPIO = [
  categoria("Bebidas", [
    item({ name: "Coca-Cola 2L" }),
    item({ name: "Água com gás" }),
    item({ name: "Suco de açaí" }),
  ]),
  categoria("Sobremesas", [
    item({ name: "Torta de cocada", description: "Leva coco fresco" }),
    item({ name: "Pudim", description: "Com calda de caramelo", is_special: true, sort_order: 2 }),
  ]),
  categoria("Pizzas", [
    item({ name: "Margherita", is_special: true, sort_order: 1 }),
    item({ name: "Calabresa", is_active: false }),
  ]),
];

describe("busca no cardápio", () => {
  it("acha pelo começo do nome", () => {
    const r = buscarNoCardapio(CARDAPIO, "coca");
    expect(r[0].item.name).toBe("Coca-Cola 2L");
  });

  it("põe quem começa com o termo antes de quem só contém", () => {
    // Quem digita "coca" quer a Coca-Cola, não a torta de cocada.
    const nomes = buscarNoCardapio(CARDAPIO, "coca").map((r) => r.item.name);
    expect(nomes[0]).toBe("Coca-Cola 2L");
    expect(nomes).toContain("Torta de cocada");
    expect(nomes.indexOf("Coca-Cola 2L")).toBeLessThan(nomes.indexOf("Torta de cocada"));
  });

  it("ignora acento nos dois sentidos", () => {
    expect(buscarNoCardapio(CARDAPIO, "acai")[0].item.name).toBe("Suco de açaí");
    expect(buscarNoCardapio(CARDAPIO, "agua")[0].item.name).toBe("Água com gás");
  });

  it("acha pela descrição quando o nome não bate", () => {
    const r = buscarNoCardapio(CARDAPIO, "caramelo");
    expect(r[0].item.name).toBe("Pudim");
  });

  it("acha pelo nome da categoria", () => {
    const nomes = buscarNoCardapio(CARDAPIO, "sobremesa").map((r) => r.item.name);
    expect(nomes).toContain("Pudim");
  });

  it("diz de qual categoria veio cada achado", () => {
    // É o que permite mostrar "Bebidas › Coca-Cola" no resultado.
    expect(buscarNoCardapio(CARDAPIO, "coca")[0].categoria.name).toBe("Bebidas");
  });

  it("não busca com menos de duas letras", () => {
    // Buscar com uma letra devolveria o cardápio inteiro, o que não ajuda
    // ninguém e ainda faz a tela piscar a cada tecla.
    expect(buscarNoCardapio(CARDAPIO, "c")).toEqual([]);
    expect(buscarNoCardapio(CARDAPIO, "")).toEqual([]);
    expect(buscarNoCardapio(CARDAPIO, "  ")).toEqual([]);
    expect(MINIMO_PARA_BUSCAR).toBe(2);
  });

  it("não mostra produto desativado", () => {
    // O produto foi tirado do ar pelo dono; achá-lo na busca faria o cliente
    // pedir algo que a cozinha não vai fazer.
    expect(buscarNoCardapio(CARDAPIO, "calabresa")).toEqual([]);
  });

  it("respeita o limite de resultados", () => {
    const muitos = [
      categoria(
        "Tudo",
        Array.from({ length: 90 }, (_, i) => item({ name: `Item ${i}` })),
      ),
    ];
    expect(buscarNoCardapio(muitos, "item").length).toBe(40);
    expect(buscarNoCardapio(muitos, "item", 5).length).toBe(5);
  });

  it("não quebra com cardápio vazio", () => {
    expect(buscarNoCardapio([], "coca")).toEqual([]);
    expect(buscarNoCardapio([categoria("Vazia", [])], "coca")).toEqual([]);
  });
});

describe("destaques", () => {
  it("mostra só o que a loja marcou como destaque", () => {
    // Sem contagem de vendas no cardápio, "mais pedidos" só pode significar
    // "o que a loja escolheu destacar". Inventar um ranking seria mentira.
    const nomes = destaquesDoCardapio(CARDAPIO).map((i) => i.name);
    expect(nomes).toEqual(["Margherita", "Pudim"]);
  });

  it("devolve vazio quando ninguém marcou nada", () => {
    // E aí o bloco inteiro não aparece, em vez de mostrar itens ao acaso sob
    // o título "mais pedidos".
    const semDestaque = [categoria("Bebidas", [item({ name: "Água" })])];
    expect(destaquesDoCardapio(semDestaque)).toEqual([]);
  });

  it("não inclui produto desativado", () => {
    const comInativo = [
      categoria("X", [item({ name: "Sumiu", is_special: true, is_active: false })]),
    ];
    expect(destaquesDoCardapio(comInativo)).toEqual([]);
  });

  it("respeita o limite", () => {
    const muitos = [
      categoria(
        "Tudo",
        Array.from({ length: 20 }, (_, i) =>
          item({ name: `D${i}`, is_special: true, sort_order: i }),
        ),
      ),
    ];
    expect(destaquesDoCardapio(muitos).length).toBe(6);
    expect(destaquesDoCardapio(muitos, 3).length).toBe(3);
  });
});
