import { describe, expect, it } from "vitest";
import { letraLegivelSobre, receitaDeCor } from "./brandColor";

describe("cor da marca que chega do FlyControl", () => {
  it("deixa passar a receita que já vem certa", () => {
    expect(receitaDeCor("38 92% 50%")).toBe("38 92% 50%");
    expect(receitaDeCor("38, 92%, 50%")).toBe("38 92% 50%");
  });

  it("traduz o hex que estava gravado e o site não entendia", () => {
    // Antes disto, #101010 chegava ao CSS como hsl(#101010): instrução que o
    // navegador ignora, e o cardápio saía sem a cor escolhida.
    expect(receitaDeCor("#101010")).toBe("0 0% 6.27%");
    expect(receitaDeCor("#FFFFFF")).toBe("0 0% 100%");
    expect(receitaDeCor("#000000")).toBe("0 0% 0%");
    expect(receitaDeCor("#f00")).toBe("0 100% 50%");
  });

  it("ignora o valor de fábrica e o vazio", () => {
    // Ninguém escolheu #FF7A00: é o que a tabela preenche sozinha quando a
    // loja nasce. Tratar como escolha faria toda loja antiga mudar de cara.
    expect(receitaDeCor("#FF7A00")).toBeNull();
    expect(receitaDeCor("#ff7a00")).toBeNull();
    expect(receitaDeCor("")).toBeNull();
    expect(receitaDeCor("   ")).toBeNull();
    expect(receitaDeCor(null)).toBeNull();
    expect(receitaDeCor(undefined)).toBeNull();
  });

  it("ignora o que não é cor em vez de quebrar o site", () => {
    expect(receitaDeCor("azul do logo")).toBeNull();
    expect(receitaDeCor("#12345")).toBeNull();
    expect(receitaDeCor("#GGGGGG")).toBeNull();
  });

  it("prende valores fora da faixa", () => {
    expect(receitaDeCor("400 150% 200%")).toBe("40 100% 100%");
  });
});

describe("letra por cima da cor do botão", () => {
  it("usa letra preta em cor clara e branca em cor escura", () => {
    // Botão amarelo com letra branca é o caso que motivou isto: some ao sol.
    expect(letraLegivelSobre(receitaDeCor("#FFD500")!)).toBe("0 0% 0%");
    expect(letraLegivelSobre(receitaDeCor("#FFFFFF")!)).toBe("0 0% 0%");
    expect(letraLegivelSobre(receitaDeCor("#101010")!)).toBe("0 0% 100%");
    expect(letraLegivelSobre(receitaDeCor("#E50914")!)).toBe("0 0% 100%");
    expect(letraLegivelSobre(receitaDeCor("#0033AA")!)).toBe("0 0% 100%");
  });

  it("não quebra com receita estranha", () => {
    expect(["0 0% 0%", "0 0% 100%"]).toContain(letraLegivelSobre("sem números"));
  });
});
