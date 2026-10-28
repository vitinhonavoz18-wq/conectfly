import { describe, expect, it } from "vitest";
import type { CartLine } from "@/lib/site/types";
import { montarCatalogoDePizza } from "./catalogo";
import { aplicarPrecosDoServidor, identidadeDaPizza, linhaDaPizza } from "./linhaDoCarrinho";
import { calcularPizza, type MontagemDePizza } from "./motorDePreco";

const catalogo = montarCatalogoDePizza({
  tamanhos: [{ label: "Grande", price: 50, max_flavors: 2 }],
  sabores: [
    { id: "cal", name: "Calabresa", ingredients: ["cebola"] },
    { id: "mus", name: "Mussarela" },
  ],
  bordas: [{ id: "cat", name: "Catupiry", price: 8 }],
  adicionais: [{ id: "bac", name: "Bacon", price: 5, max_quantity: 3 }],
  siteSettings: { pizza_premium: { permitirRemoverIngredientes: true } },
});

function linha(m: MontagemDePizza) {
  const r = calcularPizza(catalogo, m);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return linhaDaPizza({ categoriaId: "c1", montagem: m, pizza: r.pizza });
}

describe("pizza no carrinho", () => {
  it("a ordem em que o cliente tocou nos sabores não cria pizza diferente", () => {
    const a = identidadeDaPizza("c1", {
      tamanho: "grande",
      sabores: [{ id: "cal" }, { id: "mus" }],
    });
    const b = identidadeDaPizza("c1", {
      tamanho: "grande",
      sabores: [{ id: "mus" }, { id: "cal" }],
    });
    expect(a).toBe(b);
  });

  it("19. tirar a cebola, mudar a observação ou o adicional faz outra linha (não junta preços diferentes)", () => {
    const base: MontagemDePizza = { tamanho: "grande", sabores: [{ id: "cal" }] };
    const ids = new Set([
      identidadeDaPizza("c1", base),
      identidadeDaPizza("c1", { ...base, removidos: ["cebola"] }),
      identidadeDaPizza("c1", { ...base, observacao: "bem assada" }),
      identidadeDaPizza("c1", { ...base, adicionais: [{ id: "bac", quantidade: 1 }] }),
      identidadeDaPizza("c1", { ...base, adicionais: [{ id: "bac", quantidade: 2 }] }),
      identidadeDaPizza("c1", { ...base, bordaId: "cat" }),
      identidadeDaPizza("c2", base),
    ]);
    expect(ids.size).toBe(7);
  });

  it("a linha guarda a receita (sem a quantidade) e o preço calculado pela calculadora", () => {
    const l = linha({
      tamanho: "grande",
      sabores: [{ id: "cal" }, { id: "mus" }],
      bordaId: "cat",
      adicionais: [{ id: "bac", quantidade: 2 }],
      removidos: ["cebola"],
      quantidade: 3,
    });
    expect(l.unitPrice).toBe(50 + 8 + 10);
    expect(l.montagem).not.toHaveProperty("quantidade");
    expect(l.pizzaCategoryId).toBe("c1");
    expect(l.flavors).toEqual(["Calabresa (1/2)", "Mussarela (1/2)"]);
    expect(l.description).toBe(
      "Sabores: Calabresa 1/2 + Mussarela 1/2 • Borda: Catupiry • Adicionais: Bacon x2 • Sem: cebola",
    );
  });

  it("14. preço que mudou no servidor é atualizado só na pizza certa, nunca em outro item", () => {
    const pizza: CartLine = {
      ...linha({ tamanho: "grande", sabores: [{ id: "cal" }] }),
      quantity: 1,
    };
    const bebida: CartLine = {
      itemId: "bev-1",
      name: "Coca",
      description: "",
      unitPrice: 10,
      quantity: 1,
    };
    const novo = aplicarPrecosDoServidor(
      [bebida, pizza],
      [
        { indice: 1, preco_atual_centavos: 5500 },
        { indice: 0, preco_atual_centavos: 1 }, // bebida não tem montagem: fica como está
      ],
    );
    expect(novo[0]).toBe(bebida);
    expect(novo[1].unitPrice).toBe(55);
  });
});
