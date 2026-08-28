import { describe, expect, it } from "vitest";
import {
  MENU_LAYOUTS,
  SEGMENTOS,
  classesDaGrade,
  ehLayoutConhecido,
  resolverLayout,
  segmentoDe,
  type LayoutId,
} from "./menuLayout";

describe("reconhecer o segmento do que já está gravado", () => {
  it("aceita exatamente o que o painel oferece hoje", () => {
    // Estes são os valores que a tela "Minha Loja" grava em business_type.
    const doPainel: Array<[string, string]> = [
      ["Pizzaria", "pizzaria"],
      ["Pastelaria", "hamburgueria"],
      ["Hamburgueria", "hamburgueria"],
      ["Restaurante", "restaurante"],
      ["Lanchonete", "hamburgueria"],
      ["Açaíteria", "acai"],
      ["Farmácia", "farmacia"],
      ["Mercado", "mercado"],
      ["Outro", "outro"],
    ];
    for (const [gravado, esperado] of doPainel) {
      expect(segmentoDe(gravado)?.id, gravado).toBe(esperado);
    }
  });

  it("não se perde com acento nem com caixa", () => {
    expect(segmentoDe("açaíteria")?.id).toBe("acai");
    expect(segmentoDe("ACAITERIA")?.id).toBe("acai");
    expect(segmentoDe("  Farmácia  ")?.id).toBe("farmacia");
  });

  it("reconhece o segmento dentro de um nome composto", () => {
    expect(segmentoDe("Pizzaria do Zé")?.id).toBe("pizzaria");
    expect(segmentoDe("Distribuidora de bebidas")?.id).toBe("adega");
  });

  it("não confunde palavra curta dentro de outra", () => {
    // "bar" está dentro de "barbearia" — casar por pedaço curto colocaria
    // uma barbearia com layout de adega.
    expect(segmentoDe("Barbearia do João")).toBeNull();
  });

  it("devolve nulo quando não reconhece, em vez de chutar", () => {
    for (const v of ["", "   ", "Loja de tintas", null, undefined, 42, {}]) {
      expect(segmentoDe(v)).toBeNull();
    }
  });
});

describe("qual layout o cardápio usa", () => {
  it("a escolha do lojista vence o segmento", () => {
    // É o que vai permitir uma pizzaria testar o layout de hamburgueria sem
    // deixar de ser pizzaria.
    const loja = { business_type: "Pizzaria", site_settings: { menu_layout: "burger" } };
    expect(resolverLayout(loja).id).toBe("burger");
  });

  it("sem escolha, usa o recomendado para o segmento", () => {
    expect(resolverLayout({ business_type: "Farmácia" }).id).toBe("pharmacy");
    expect(resolverLayout({ business_type: "Açaíteria" }).id).toBe("acai");
  });

  it("loja antiga, sem nada, cai no padrão — que é o cardápio de antes", () => {
    // A trava que impede o cardápio de quem nunca abriu esta tela de mudar
    // de cara sozinho.
    expect(resolverLayout(null).id).toBe("generic");
    expect(resolverLayout(undefined).id).toBe("generic");
    expect(resolverLayout({}).id).toBe("generic");
    expect(resolverLayout({ business_type: "Loja de tintas" }).id).toBe("generic");
  });

  it("layout inválido não quebra o cardápio", () => {
    // Cardápio no ar não pode cair porque alguém gravou lixo no campo.
    for (const lixo of ["pizza_modern_v9", "", null, 42, {}]) {
      const loja = { business_type: "Pizzaria", site_settings: { menu_layout: lixo } };
      expect(resolverLayout(loja).id).toBe("pizza");
    }
  });

  it("ehLayoutConhecido só aceita layout que existe", () => {
    expect(ehLayoutConhecido("pizza")).toBe(true);
    expect(ehLayoutConhecido("pizza_premium")).toBe(false);
    expect(ehLayoutConhecido(null)).toBe(false);
  });
});

describe("integridade dos layouts", () => {
  it("todo segmento aponta para um layout que existe", () => {
    for (const s of SEGMENTOS) {
      expect(MENU_LAYOUTS[s.layoutRecomendado], s.id).toBeTruthy();
    }
  });

  it("todo layout monta o cardápio de produtos", () => {
    // Um layout sem o bloco "cardapio" seria uma loja sem produtos na tela.
    for (const id of Object.keys(MENU_LAYOUTS) as LayoutId[]) {
      expect(MENU_LAYOUTS[id].ordem, id).toContain("cardapio");
    }
  });

  it("o id de cada layout bate com a chave", () => {
    for (const id of Object.keys(MENU_LAYOUTS) as LayoutId[]) {
      expect(MENU_LAYOUTS[id].id).toBe(id);
    }
  });

  it("nenhum layout repete um bloco", () => {
    for (const id of Object.keys(MENU_LAYOUTS) as LayoutId[]) {
      const ordem = MENU_LAYOUTS[id].ordem;
      expect(new Set(ordem).size, id).toBe(ordem.length);
    }
  });

  it("quem tem busca em destaque monta o bloco de busca", () => {
    for (const id of Object.keys(MENU_LAYOUTS) as LayoutId[]) {
      const l = MENU_LAYOUTS[id];
      if (l.buscaEmDestaque) expect(l.ordem, id).toContain("busca");
    }
  });

  it("o layout padrão é exatamente a estrutura antiga", () => {
    expect(MENU_LAYOUTS.generic.ordem).toEqual(["capa", "pizzas", "combos", "cardapio", "bebidas"]);
  });

  it("todo layout tem um texto de botão", () => {
    for (const id of Object.keys(MENU_LAYOUTS) as LayoutId[]) {
      expect(MENU_LAYOUTS[id].ctaProduto.trim().length, id).toBeGreaterThan(0);
    }
  });
});

describe("grade de produtos", () => {
  it("sempre começa em uma ou duas colunas no celular", () => {
    // Mobile primeiro: quatro colunas num aparelho de 360px viram tarja.
    for (const id of Object.keys(MENU_LAYOUTS) as LayoutId[]) {
      const classes = classesDaGrade(MENU_LAYOUTS[id]);
      expect(classes.startsWith("grid-cols-1") || classes.startsWith("grid-cols-2"), id).toBe(true);
    }
  });

  it("mercado mostra mais produtos por tela que pizzaria", () => {
    expect(MENU_LAYOUTS.market.colunas).toBeGreaterThan(MENU_LAYOUTS.pizza.colunas);
  });
});
