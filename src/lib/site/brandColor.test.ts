import { describe, expect, it } from "vitest";
import {
  apagadoSobre,
  bordaSobre,
  ehEscuro,
  letraLegivelSobre,
  receitaDeCor,
  superficieSobre,
  textoApagadoSobre,
  textoPrincipalSobre,
} from "./brandColor";

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

describe("peças derivadas do fundo escolhido", () => {
  const FUNDOS = ["#101010", "#F4F1EA", "#14213D", "#FFFFFF", "#000000", "#2E1A47", "#FAFAFA"];

  // ESTES NÚMEROS SÃO O CONTRATO ENTRE OS DOIS SISTEMAS.
  //
  // A prévia do FlyControl calcula as mesmas peças com as mesmas contas
  // (lib/theme/color.ts). Se um lado mudar e o outro não, a prévia passa a
  // prometer uma coisa e o cardápio a entregar outra — e o teste que quebra
  // é este.
  it("bate exatamente com a conta que a prévia do painel usa", () => {
    const preto = receitaDeCor("#101010")!;
    expect(preto).toBe("0 0% 6.27%");
    expect(superficieSobre(preto)).toBe("0 0% 11.27%");
    expect(apagadoSobre(preto)).toBe("0 0% 14.27%");
    expect(bordaSobre(preto)).toBe("0 0% 22.27%");
    expect(textoPrincipalSobre(preto)).toBe("0 0% 98%");
    expect(textoApagadoSobre(preto)).toBe("0 0% 68%");

    const claro = receitaDeCor("#F4F1EA")!;
    expect(textoPrincipalSobre(claro)).toBe("222 47% 11%");
    expect(ehEscuro(claro)).toBe(false);
  });

  it("o card nunca sai da mesma cor do fundo", () => {
    // Sem isto, um fundo preto teria card preto: os produtos sumiriam, como
    // prato branco servido sobre toalha branca.
    for (const hex of FUNDOS) {
      const fundo = receitaDeCor(hex)!;
      expect(superficieSobre(fundo), hex).not.toBe(fundo);
      expect(bordaSobre(fundo), hex).not.toBe(fundo);
    }
  });

  it("clareia sobre fundo escuro e escurece sobre fundo claro", () => {
    const luz = (r: string) => Number(r.split(" ")[2].replace("%", ""));

    const escuro = receitaDeCor("#101010")!;
    expect(luz(superficieSobre(escuro))).toBeGreaterThan(luz(escuro));
    expect(luz(bordaSobre(escuro))).toBeGreaterThan(luz(escuro));

    const branco = receitaDeCor("#FFFFFF")!;
    expect(luz(superficieSobre(branco))).toBeLessThan(luz(branco));
    expect(luz(bordaSobre(branco))).toBeLessThan(luz(branco));
  });
});
