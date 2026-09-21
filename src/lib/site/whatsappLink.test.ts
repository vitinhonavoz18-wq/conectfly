import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { numeroParaWhatsApp, linkDoWhatsApp } from "./whatsappLink";

/**
 * O estrago que estes testes evitam é sempre o mesmo: o cliente confirma o
 * pedido e, em vez do WhatsApp da loja, vê uma tela de erro — e conclui que
 * a compra não foi feita.
 */

describe("o número que o WhatsApp aceita", () => {
  it("completa o código do país quando falta", () => {
    // A maioria das lojas está cadastrada assim. Sem o 55 na frente, o link
    // nunca abriu: é o telefone do guardanapo sem o DDD.
    expect(numeroParaWhatsApp("71992064951")).toBe("5571992064951");
    expect(numeroParaWhatsApp("7132224444")).toBe("557132224444");
  });

  it("não mexe em quem já veio completo", () => {
    expect(numeroParaWhatsApp("5571992064951")).toBe("5571992064951");
    expect(numeroParaWhatsApp("557132224444")).toBe("557132224444");
  });

  it("aceita o número escrito como gente escreve", () => {
    // O painel deixa digitar com parênteses, espaço e traço.
    expect(numeroParaWhatsApp("(71) 99206-4951")).toBe("5571992064951");
    expect(numeroParaWhatsApp("+55 71 99206-4951")).toBe("5571992064951");
  });

  it("número pela metade não vira link nenhum", () => {
    // Abrir o WhatsApp com número quebrado é PIOR do que não abrir: o
    // cliente vê "número inválido" logo depois de confirmar o pedido.
    expect(numeroParaWhatsApp("9206495")).toBeNull();
    expect(numeroParaWhatsApp("123")).toBeNull();
    expect(numeroParaWhatsApp("")).toBeNull();
    expect(numeroParaWhatsApp(null)).toBeNull();
    expect(numeroParaWhatsApp(undefined)).toBeNull();
    expect(numeroParaWhatsApp("não é telefone")).toBeNull();
  });

  it("o endereço sai pronto, com a mensagem escapada", () => {
    const link = linkDoWhatsApp("71992064951", "Pedido #12 — 1 Açaí 500ml");
    expect(link).toContain("https://wa.me/5571992064951?text=");
    expect(link).toContain(encodeURIComponent("Pedido #12 — 1 Açaí 500ml"));
  });

  it("sem número utilizável, não há endereço", () => {
    expect(linkDoWhatsApp("", "Pedido")).toBeNull();
    expect(linkDoWhatsApp("123", "Pedido")).toBeNull();
  });
});

describe("o pedido NÃO pode depender do WhatsApp", () => {
  function soCodigo(caminho: string): string {
    return readFileSync(join(process.cwd(), caminho), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  }

  it("o checkout não recusa mais a entrega por falta de WhatsApp", () => {
    // Era o defeito: o site barrava um pedido de entrega inteiro porque
    // faltava o AVISO pós-venda. Quem manda no pedido é o FlyControl; o
    // WhatsApp é o bilhete que vai junto. Recusar a venda por causa do
    // bilhete é fechar a loja porque acabou o papel da comanda.
    const codigo = soCodigo("src/components/site/checkout/useCheckoutCore.ts");
    expect(codigo).not.toContain("Loja sem WhatsApp configurado");
  });

  it("o link do WhatsApp é montado pelo lugar que sabe completar o número", () => {
    const codigo = soCodigo("src/components/site/checkout/useCheckoutCore.ts");
    expect(codigo).toContain("linkDoWhatsApp");
    // Montar o endereço na mão de novo faria o 55 faltar outra vez.
    expect(codigo).not.toContain("https://wa.me/${whatsappNumber}");
  });
});
