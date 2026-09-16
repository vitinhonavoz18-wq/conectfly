import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adicionaisDaCategoria, montarVinculos } from "./adicionaisDaCategoria";

/**
 * O cenário que o dono pediu para conferir:
 *
 *   Categoria A ................ Adicional 1
 *   Categoria B ................ Adicional 2
 *   Categorias A e B ........... Adicional 3
 *
 * Cada produto só pode receber os adicionais da categoria dele.
 */
const CAT_A = "categoria-pasteis";
const CAT_B = "categoria-hamburgueres";
const CAT_C = "categoria-acai";

const AD_1 = { id: "adicional-1", name: "Queijo", price: 3 };
const AD_2 = { id: "adicional-2", name: "Leite Ninho", price: 4 };
const AD_3 = { id: "adicional-3", name: "Bacon", price: 5 };

const TODOS = [AD_1, AD_2, AD_3];

const vinculos = montarVinculos([
  { addon_item_id: AD_1.id, category_id: CAT_A },
  { addon_item_id: AD_2.id, category_id: CAT_B },
  { addon_item_id: AD_3.id, category_id: CAT_A },
  { addon_item_id: AD_3.id, category_id: CAT_B },
]);

function nomes(lista: { name: string }[]) {
  return lista.map((a) => a.name);
}

describe("cada produto recebe só os adicionais da categoria dele", () => {
  it("produto de Pastéis vê Queijo e Bacon — nunca Leite Ninho", () => {
    expect(nomes(adicionaisDaCategoria(TODOS, CAT_A, vinculos))).toEqual(["Queijo", "Bacon"]);
  });

  it("produto de Hambúrgueres vê Leite Ninho e Bacon — nunca Queijo", () => {
    expect(nomes(adicionaisDaCategoria(TODOS, CAT_B, vinculos))).toEqual(["Leite Ninho", "Bacon"]);
  });

  it("produto de Açaí não vê nenhum dos três", () => {
    // Era exatamente isto que acontecia ao contrário: quem ia pedir açaí era
    // oferecido bacon.
    expect(adicionaisDaCategoria(TODOS, CAT_C, vinculos)).toEqual([]);
  });

  it("o adicional vinculado a duas categorias é UM só, não uma cópia por categoria", () => {
    // Bacon aparece nas duas listas, mas é o mesmo registro: mudar o preço
    // dele muda nos dois lugares, porque é o mesmo Bacon.
    const emA = adicionaisDaCategoria(TODOS, CAT_A, vinculos).find((a) => a.name === "Bacon");
    const emB = adicionaisDaCategoria(TODOS, CAT_B, vinculos).find((a) => a.name === "Bacon");
    expect(emA).toBe(emB);
    expect(emA?.id).toBe(AD_3.id);
  });
});

describe("a trava que protege quem já está vendendo", () => {
  it("adicional SEM vínculo aparece em TODAS as categorias", () => {
    // A regra mais importante do arquivo. No dia em que isto entrou no ar,
    // nenhum adicional tinha vínculo — e nenhum podia sumir do cardápio de
    // ninguém. Se alguém inverter isso, este teste cai antes de a loja do
    // cliente ficar sem bacon.
    const semVinculo = montarVinculos([]);
    expect(nomes(adicionaisDaCategoria(TODOS, CAT_A, semVinculo))).toEqual([
      "Queijo",
      "Leite Ninho",
      "Bacon",
    ]);
    expect(adicionaisDaCategoria(TODOS, CAT_C, semVinculo)).toHaveLength(3);
  });

  it("um adicional global convive com outros vinculados", () => {
    const mistos = montarVinculos([{ addon_item_id: AD_1.id, category_id: CAT_A }]);
    // Queijo só em Pastéis; os outros dois sem vínculo, logo em tudo.
    expect(nomes(adicionaisDaCategoria(TODOS, CAT_A, mistos))).toEqual([
      "Queijo",
      "Leite Ninho",
      "Bacon",
    ]);
    expect(nomes(adicionaisDaCategoria(TODOS, CAT_B, mistos))).toEqual(["Leite Ninho", "Bacon"]);
  });

  it("se os vínculos não carregarem, o cardápio mostra tudo em vez de ficar vazio", () => {
    // Falha de leitura não pode apagar os adicionais do cardápio. Mostrar tudo
    // é o comportamento antigo: chato, mas ninguém deixa de vender.
    expect(adicionaisDaCategoria(TODOS, CAT_A, undefined)).toHaveLength(3);
  });

  it("produto sem categoria recebe só os adicionais globais", () => {
    const mistos = montarVinculos([{ addon_item_id: AD_1.id, category_id: CAT_A }]);
    expect(nomes(adicionaisDaCategoria(TODOS, null, mistos))).toEqual(["Leite Ninho", "Bacon"]);
  });
});

describe("montar o mapa de vínculos", () => {
  it("junta as várias categorias do mesmo adicional numa lista só", () => {
    expect(vinculos[AD_3.id]).toEqual([CAT_A, CAT_B]);
  });

  it("ignora linha quebrada em vez de derrubar o cardápio", () => {
    const sujo = montarVinculos([
      { addon_item_id: AD_1.id, category_id: CAT_A },
      { addon_item_id: "", category_id: CAT_B },
      { addon_item_id: AD_2.id, category_id: "" },
    ] as { addon_item_id: string; category_id: string }[]);
    expect(sujo).toEqual({ [AD_1.id]: [CAT_A] });
  });

  it("lista nula vira mapa vazio", () => {
    expect(montarVinculos(null)).toEqual({});
  });
});

describe("as telas do cardápio usam o filtro", () => {
  it("o card do produto filtra pela categoria dele", () => {
    const card = readFileSync("src/components/site/SiteMenuItemCard.tsx", "utf8");
    expect(card).toContain("adicionaisDaCategoria(");
    expect(card).toContain("item.category_id");
    // Ler a lista crua de volta reabriria o problema em metade da tela.
    expect(card).not.toMatch(/const extras = adicionaisCategory\?\.items \?\? \[\]/);
  });

  it("o montador de pizza filtra pela categoria da pizza", () => {
    const builder = readFileSync("src/components/site/SitePizzaBuilder.tsx", "utf8");
    expect(builder).toContain("adicionaisDaCategoria(");
    // Nenhum ponto pode voltar a ler a lista inteira: o filtro passaria a
    // valer só em parte da tela, que é pior do que não filtrar.
    expect(builder).not.toContain("adicionaisCategory!.items.map");
    expect(builder).not.toContain("adicionaisCategory?.items.find");
  });

  it("o cardápio carrega os vínculos junto com o resto", () => {
    const queries = readFileSync("src/lib/site/queries.ts", "utf8");
    expect(queries).toContain("menu_addon_categories");
    expect(queries).toContain("vinculosDeAdicional");
  });
});

describe("a rota de sincronização grava os vínculos", () => {
  const rota = readFileSync("src/routes/api/menu-sync.$.ts", "utf8");

  it("category_ids não vai para a tabela de itens", () => {
    // Não é coluna de `menu_items`; deixar passar derruba a gravação inteira.
    expect(rota).toContain("delete data.category_ids");
  });

  it("silêncio sobre vínculos preserva os que já existem", () => {
    // A sincronização em massa do cardápio só manda nome e preço. Se isso
    // apagasse os vínculos, uma sincronização de rotina desmancharia em
    // silêncio a configuração que o lojista montou.
    const inicio = rota.indexOf("async function gravarVinculosDoAdicional");
    const bloco = rota.slice(inicio, inicio + 900);
    expect(bloco).toContain("if (categoryIds === undefined) return");
  });

  it("só aceita categoria que existe e é desta loja", () => {
    // O código chega de fora. Sem esta conferência, bastaria mandar o número
    // de uma categoria do vizinho.
    const inicio = rota.indexOf("async function gravarVinculosDoAdicional");
    const bloco = rota.slice(inicio, inicio + 2000);
    expect(bloco).toContain('.eq("restaurant_id", restaurantId)');
  });
});
