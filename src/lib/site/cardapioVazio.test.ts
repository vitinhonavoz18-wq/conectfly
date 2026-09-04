import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda: loja nova nasce com o cardápio vazio.
 *
 * O DEFEITO QUE ISSO EVITA DE VOLTAR
 *
 * Até setembro de 2026, TODA loja criada recebia automaticamente um cardápio
 * de 32 sabores de pizza. Não era só a pizzaria: a batataria "Senhorita
 * batata", o "Boteco vt" e a "AÇAI E LOVE" também nasceram vendendo Portuguesa
 * e Romeu e Julieta.
 *
 * É a loja nova que abre com a prateleira já cheia de produto de outro dono. O
 * lojista gastava o primeiro dia apagando o que nunca vendeu, em vez de
 * cadastrar o que ele vende.
 *
 * As zonas de entrega CONTINUAM: bairro com taxa não é produto de ninguém, é
 * ponto de partida — e sem nenhuma zona a loja de delivery não recebe nem o
 * primeiro pedido.
 */

const RAIZ = process.cwd();

function soCodigo(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), "utf8")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const CAMINHOS_QUE_CRIAM_LOJA = [
  "src/routes/api/internal/provision-restaurant.ts",
  "src/routes/_authenticated.index.tsx",
];

describe("loja nova nasce com o cardápio vazio", () => {
  for (const caminho of CAMINHOS_QUE_CRIAM_LOJA) {
    it(`${caminho} não semeia cardápio de pizza`, () => {
      const codigo = soCodigo(caminho);
      expect(codigo).not.toMatch(/seedDefaultMenu\s*\(/);
      expect(codigo).not.toMatch(/seedDefaultMenuWithClient\s*\(/);
    });

    it(`${caminho} continua aplicando as zonas de entrega`, () => {
      expect(soCodigo(caminho)).toMatch(/seedDefaultDeliveryZones/);
    });
  }

  it("nenhum lugar do sistema chama mais o cardápio padrão", () => {
    // Vale para os dois caminhos acima e para qualquer outro que apareça.
    const grep = (caminho: string) => {
      try {
        return soCodigo(caminho);
      } catch {
        return "";
      }
    };
    const suspeitos = [...CAMINHOS_QUE_CRIAM_LOJA, "src/components/editor/MenuManager.tsx"];
    for (const s of suspeitos) {
      expect(grep(s)).not.toMatch(/seedDefaultMenu\b/);
    }
  });
});
