import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A aba de bebidas do cardápio.
 *
 * O QUE QUEBROU
 *
 * O botão "+" ficava FORA do card e era escondido pelo `overflow-hidden`. O
 * cliente via a foto, o preço, o "−" e o "0", e não tinha como somar a
 * segunda bebida. Medido com o navegador na Açaí Deus Provera: os 7 cards
 * cortados em TODAS as larguras de 768px a 1366px, com o "+" chegando a ficar
 * 91px para fora.
 *
 * A causa era sempre a mesma: nada podia encolher. Card, foto e coluna de
 * texto estavam todos proibidos de diminuir, então, quando a coluna ficava
 * estreita, em vez de se ajustarem eles vazavam — e o que vazou foi
 * justamente o botão de comprar.
 *
 * É o armário que não fecha porque tem uma colher atravessada: a porta não
 * está torta, tem coisa lá dentro que se recusa a ceder.
 *
 * Estes testes guardam cada peça que precisa poder ceder.
 */
/**
 * Só o código, sem os comentários.
 *
 * Os comentários do arquivo CITAM as classes antigas para explicar o que deu
 * errado. Sem tirá-los, um teste que procura "a classe velha sumiu?" acha a
 * explicação e acusa em falso — foi o que aconteceu na primeira tentativa.
 */
function soCodigo(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const secao = soCodigo("src/components/site/SiteBeverageSection.tsx");
const menu = soCodigo("src/components/site/SiteMenuSection.tsx");

describe("o botão de somar bebida não pode sair do card", () => {
  it("o card pode encolher dentro da coluna", () => {
    // Sem `min-w-0` o card se recusa a ficar menor que o conteúdo dele e
    // vaza para fora da coluna, levando o "+" junto.
    expect(secao).toMatch(/border flex min-w-0 transition-colors/);
  });

  it("a coluna de texto pode encolher", () => {
    expect(secao).toMatch(/flex flex-col flex-1 min-w-0/);
  });

  it("a foto tem largura escrita, não deduzida do arquivo", () => {
    // `sm:w-auto` fazia o navegador tirar a largura do tamanho natural da
    // imagem (400px de lado viram 192px na altura h-48) e `shrink-0` proibia
    // encolher: a foto sozinha comia dois terços do card.
    expect(secao).toContain("w-20 sm:w-28 md:w-32");
    expect(secao).not.toContain("sm:w-auto");
    expect(secao).not.toContain("sm:h-48");
  });

  it("a linha dos botões pode quebrar", () => {
    // Em coluna estreita o subtotal desce para a linha de baixo em vez de
    // espremer os botões para fora.
    expect(secao).toMatch(/mt-auto flex flex-wrap items-center/);
  });

  it("os botões de quantidade nunca encolhem nem somem", () => {
    // Quem tem de caber inteiro é o controle de quantidade: é ele que faz o
    // pedido acontecer.
    const controles = secao.slice(secao.indexOf("mt-auto flex flex-wrap"));
    expect(controles).toContain("h-9 w-9 shrink-0");
    expect(controles.match(/h-9 w-9 shrink-0/g)?.length).toBe(2);
  });
});

describe("três colunas só quando o card cabe", () => {
  it("a terceira coluna só entra a partir de 1280px", () => {
    // A 1024px, três colunas deixavam cada card com 267px — não cabia a foto
    // mais os botões. O card é DEITADO, então ele precisa de largura.
    expect(secao).toContain("grid-cols-1 sm:grid-cols-2 xl:grid-cols-3");
    expect(secao).not.toContain("lg:grid-cols-3");
  });
});

describe("a página não pode deslizar para o lado no celular", () => {
  it("o título da seção quebra em vez de vazar", () => {
    // "AÇAÍ NA GARRAFA E VITAMINAS" pede 411px numa tela de 390. Com
    // `shrink-0` ele não cabia e empurrava a página inteira para o lado.
    expect(menu).not.toMatch(/text-2xl sm:text-4xl[^"]*shrink-0/);
    expect(menu).toMatch(/min-w-0 text-center text-xl sm:text-3xl md:text-4xl/);
  });

  it("o nome da bebida aparece inteiro, em duas linhas", () => {
    // "CERVEJA ITAIPAV…" não diz se é lata ou long neck, e ninguém compra o
    // que não consegue ler.
    expect(secao).toContain("line-clamp-2");
  });
});
