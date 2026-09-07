import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gradeParaBlocos } from "./rodapeGrade";

/**
 * Guarda do rodapé do cardápio.
 *
 * O rodapé mostra telefone, horário e endereço — mas nem toda loja preenche
 * os três. A grade precisa abrir exatamente o número de lugares que vai
 * usar. Se ela sempre reservar três, a loja que preencheu dois fica com os
 * blocos encostados na esquerda e um vão enorme sobrando à direita: a mesa
 * posta para três com dois pratos.
 */

describe("colunas do rodapé do cardápio", () => {
  it("abre um lugar para cada bloco que vai aparecer", () => {
    expect(gradeParaBlocos(3)).toContain("sm:grid-cols-3");
    expect(gradeParaBlocos(2)).toContain("sm:grid-cols-2");
    expect(gradeParaBlocos(1)).toContain("sm:grid-cols-1");
  });

  it("com menos de três, segura a largura para o conjunto ficar centralizado", () => {
    // Sem o teto de largura, dois blocos numa grade de 1215px ficariam
    // separados por meia tela de vazio — juntos no papel, distantes na tela.
    expect(gradeParaBlocos(2)).toContain("max-w");
    expect(gradeParaBlocos(1)).toContain("max-w");
    // Com os três, nada de teto: é o caso da maioria das lojas e ele
    // continua exatamente como sempre foi.
    expect(gradeParaBlocos(3)).not.toContain("max-w");
  });

  it("loja sem nenhum dado preenchido não quebra a conta", () => {
    expect(gradeParaBlocos(0)).toContain("sm:grid-cols-1");
  });

  it("a contagem usa a mesma regra que decide se o bloco aparece", () => {
    // Se as duas regras se separarem, a grade abre um número de lugares que
    // não corresponde ao que é desenhado — e o rodapé entorta de novo, sem
    // ninguém mexer no visual.
    const fonte = readFileSync(join(process.cwd(), "src/components/site/SiteFooter.tsx"), "utf8");
    expect(fonte).toContain("[phoneDisplay, hours, address || city].filter(Boolean).length");
    expect(fonte).toContain("{phoneDisplay && (");
    expect(fonte).toContain("{hours && (");
    expect(fonte).toContain("{(address || city) && (");
  });
});

/**
 * Guarda do alinhamento entre as colunas.
 *
 * Não basta abrir o número certo de lugares: os três blocos precisam dividir
 * as mesmas faixas de altura. Sem isso, um rótulo que quebra em duas linhas
 * empurra só o seu bloco para baixo e o rodapé entorta de novo.
 */
describe("alinhamento das colunas do rodapé", () => {
  const fonte = readFileSync(join(process.cwd(), "src/components/site/SiteFooter.tsx"), "utf8");

  it("a grade declara as três faixas: ícone, rótulo e conteúdo", () => {
    expect(fonte).toContain("sm:grid-rows-[auto_auto_1fr]");
  });

  it("todo bloco encaixa nas mesmas faixas, em vez de empilhar por conta própria", () => {
    expect(fonte).toContain("sm:grid-rows-subgrid sm:row-span-3");
    // Os três blocos usam o MESMO encaixe — se um ficar de fora, ele volta a
    // descer sozinho.
    expect(fonte.match(/\$\{blocoAlinhado\}/g)?.length).toBe(3);
  });

  it("texto comprido quebra dentro da coluna em vez de vazar", () => {
    expect(fonte.match(/break-words/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
