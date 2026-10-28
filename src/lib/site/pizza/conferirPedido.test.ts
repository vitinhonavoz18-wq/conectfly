import { describe, expect, it } from "vitest";
import { montarCatalogoDePizza } from "./catalogo";
import { conferirItensDePizza } from "./conferirPedido";
import type { CatalogoDePizza } from "./motorDePreco";

/**
 * O porteiro do preço no servidor: o que chega do navegador é pedido, o que
 * vale é o cardápio do banco.
 */

const LOJA_A_CATEGORIA = "cat-pizza-loja-a";

function catalogoDaLojaA(regra = "maior_preco"): CatalogoDePizza {
  return montarCatalogoDePizza({
    tamanhos: [
      { label: "Média", price: 40, max_flavors: 2, slices: 6, active: true },
      { label: "Grande", price: "50.00", max_flavors: 3, slices: 8, active: true },
    ],
    sabores: [
      {
        id: "calabresa",
        name: "Calabresa",
        price: 0,
        pizza_size_prices_cents: { media: 4000, grande: 5000 },
        ingredients: ["cebola"],
      },
      {
        id: "camarao",
        name: "Camarão",
        price: 0,
        is_special: true,
        special_extra: 15,
        pizza_size_prices_cents: { Grande: 7900 },
      },
      { id: "fora", name: "Fora do cardápio", is_active: false },
    ],
    bordas: [
      { id: "catupiry", name: "Catupiry", price: 8, pizza_size_prices_cents: { grande: 1000 } },
    ],
    adicionais: [{ id: "bacon", name: "Bacon", price: "5,00", max_quantity: 3 }],
    siteSettings: { pizza_premium: { regra, permitirRemoverIngredientes: true } },
  });
}

/** Só a loja A tem esta categoria. Qualquer outra volta "não existe". */
async function carregar(categoriaId: string) {
  return categoriaId === LOJA_A_CATEGORIA ? catalogoDaLojaA() : null;
}

function pizza(extra: Record<string, unknown> = {}) {
  return {
    type: "pizza",
    name: "Pizza Grande",
    quantity: 2,
    unit_price: 79 + 10 + 10, // camarão 79 (maior preço) + borda 10 + bacon 2x5
    total_price: (79 + 10 + 10) * 2,
    pizza_category_id: LOJA_A_CATEGORIA,
    montagem: {
      tamanho: "grande",
      sabores: [{ id: "calabresa" }, { id: "camarao" }],
      bordaId: "catupiry",
      adicionais: [{ id: "bacon", quantidade: 2 }],
      removidos: ["cebola"],
      observacao: "bem assada",
    },
    ...extra,
  };
}

const bebida = { type: "beverage", name: "Coca 2L", quantity: 1, unit_price: 12, total_price: 12 };

describe("conferência das pizzas no servidor", () => {
  it("17. preço certo: o item vira a versão oficial, com a fotografia completa", async () => {
    const r = await conferirItensDePizza({
      itens: [pizza(), bebida],
      subtotalEnviado: 198 + 12,
      carregarCatalogo: carregar,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [p, b] = r.itens as any[];
    expect(p.unit_price).toBe(99);
    expect(p.total_price).toBe(198);
    expect(p.pizza.versao).toBe(1);
    expect(p.pizza.sabores.map((s: any) => [s.nome, s.fracao])).toEqual([
      ["Calabresa", "1/2"],
      ["Camarão", "1/2"],
    ]);
    expect(p.pizza.borda.nome).toBe("Catupiry");
    expect(p.pizza.adicionais[0]).toMatchObject({
      nome: "Bacon",
      quantidade: 2,
      total_centavos: 1000,
    });
    expect(p.pizza.removidos).toEqual(["cebola"]);
    // Campos que a cozinha, o Kanban e a impressão já sabem ler:
    expect(p.size).toBe("Grande");
    expect(p.flavors).toEqual(["Calabresa (1/2)", "Camarão (1/2)"]);
    expect(p.crust).toBe("Catupiry");
    expect(p.description).toContain("PIZZA GRANDE");
    // A bebida passa intacta.
    expect(b).toEqual(bebida);
    expect(r.subtotal).toBe(210);
  });

  it("15. total adulterado no navegador é recusado e o preço oficial é devolvido", async () => {
    const r = await conferirItensDePizza({
      itens: [pizza({ unit_price: 1, total_price: 2 })],
      subtotalEnviado: 2,
      carregarCatalogo: carregar,
    });
    expect(r).toEqual({
      ok: false,
      motivo: "preco_mudou",
      diferencas: [
        {
          indice: 0,
          nome: "Pizza Grande",
          preco_enviado_centavos: 100,
          preco_atual_centavos: 9900,
        },
      ],
    });
  });

  it("14. preço reajustado durante a montagem: volta para o cliente confirmar", async () => {
    const reajustado = async () => {
      const c = catalogoDaLojaA();
      c.sabores[1].precosPorTamanho.grande = 8500;
      return c;
    };
    const r = await conferirItensDePizza({
      itens: [pizza()],
      subtotalEnviado: 198,
      carregarCatalogo: reajustado,
    });
    expect(r.ok).toBe(false);
    if (r.ok || r.motivo !== "preco_mudou") throw new Error("esperava preco_mudou");
    expect(r.diferencas[0].preco_atual_centavos).toBe(8500 + 1000 + 1000);
  });

  it("15b. subtotal menor que a soma dos itens é recusado", async () => {
    const r = await conferirItensDePizza({
      itens: [pizza(), bebida],
      subtotalEnviado: 50,
      carregarCatalogo: carregar,
    });
    expect(r).toMatchObject({ ok: false, motivo: "subtotal_inconsistente", soma_dos_itens: 210 });
  });

  it("9. sabor que saiu do cardápio é recusado com o motivo", async () => {
    const r = await conferirItensDePizza({
      itens: [
        pizza({
          montagem: { tamanho: "media", sabores: [{ id: "fora" }] },
          unit_price: 40,
          total_price: 80,
        }),
      ],
      subtotalEnviado: 80,
      carregarCatalogo: carregar,
    });
    expect(r).toMatchObject({ ok: false, motivo: "montagem_invalida" });
    if (!r.ok && r.motivo === "montagem_invalida")
      expect(r.erros[0].codigo).toBe("sabor_indisponivel");
  });

  it("16. categoria de outra pizzaria não serve de cardápio", async () => {
    const r = await conferirItensDePizza({
      itens: [pizza({ pizza_category_id: "cat-de-outra-loja" })],
      subtotalEnviado: 198,
      carregarCatalogo: carregar,
    });
    expect(r).toEqual({ ok: false, motivo: "cardapio_indisponivel", indice: 0 });
  });

  it("a quantidade que vale é a do carrinho, não a de dentro da montagem", async () => {
    const r = await conferirItensDePizza({
      itens: [
        pizza({ quantity: 1, total_price: 99, montagem: { ...pizza().montagem, quantidade: 40 } }),
      ],
      subtotalEnviado: 99,
      carregarCatalogo: carregar,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.itens[0] as any).pizza.quantidade).toBe(1);
  });

  it("20. pedido só com produtos comuns e pizzas do formato antigo passa como antes", async () => {
    const antiga = {
      type: "pizza",
      name: "Pizza Média",
      size: "Média",
      flavors: ["Calabresa"],
      quantity: 1,
      unit_price: 40,
      total_price: 40,
    };
    const itens = [antiga, bebida];
    const r = await conferirItensDePizza({
      itens,
      subtotalEnviado: 999,
      carregarCatalogo: carregar,
    });
    // Nenhuma pizza do configurador: nada é recalculado nem recusado.
    expect(r).toEqual({ ok: true, itens, subtotal: 52, conferidas: 0 });
  });

  it("19. duas pizzas iguais com montagens diferentes seguem separadas, cada uma com seu preço", async () => {
    const simples = pizza({
      quantity: 1,
      unit_price: 50,
      total_price: 50,
      montagem: { tamanho: "grande", sabores: [{ id: "calabresa" }] },
    });
    const r = await conferirItensDePizza({
      itens: [pizza(), simples],
      subtotalEnviado: 248,
      carregarCatalogo: carregar,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.itens.map((i: any) => i.pizza.preco_unitario_centavos)).toEqual([9900, 5000]);
    expect(r.itens.map((i: any) => i.pizza.adicionais.length)).toEqual([1, 0]);
  });
});

describe("cardápio do banco → catálogo do motor", () => {
  it("converte reais em centavos, normaliza tamanhos e lê a configuração", () => {
    const c = catalogoDaLojaA("media_ponderada");
    expect(c.tamanhos.map((t) => [t.chave, t.precoBaseCentavos, t.maxSabores])).toEqual([
      ["media", 4000, 2],
      ["grande", 5000, 3],
    ]);
    expect(c.sabores[1]).toMatchObject({
      extraEspecialCentavos: 1500,
      precosPorTamanho: { grande: 7900 },
    });
    expect(c.sabores[2].ativo).toBe(false);
    expect(c.adicionais[0]).toMatchObject({ precoCentavos: 500, maxQuantidade: 3 });
    expect(c.config.regra).toBe("media_ponderada");
  });

  it("loja sem configuração mantém a regra antiga (nenhum preço muda sozinho)", () => {
    const c = montarCatalogoDePizza({
      tamanhos: [],
      sabores: [],
      bordas: [],
      adicionais: [],
      siteSettings: null,
    });
    expect(c.config.regra).toBe("tamanho_e_especiais");
  });
});
