/**
 * Que tipo de seção é cada categoria do cardápio.
 *
 * Bordas e adicionais chegam do FlyControl como categorias comuns — não
 * existe uma marca no banco dizendo "isto é uma borda". O que identifica é o
 * nome. Por isso a regra fica aqui, em um lugar só: ela estava copiada nos
 * quatro modelos de site, e uma cópia esquecida faria a seção "Adicionais"
 * reaparecer no meio do cardápio só naquele modelo.
 *
 * Os nomes reconhecidos são os mesmos que a sincronização cria do outro lado
 * (ver `EXTRA_CATEGORY` em `routes/api/menu-sync.$.ts`), mais as variações
 * que um dono pode ter digitado à mão no editor.
 */

const BORDAS_NAMES = ["bordas recheadas", "borda recheada", "bordas", "borda"];

const ADICIONAIS_NAMES = ["adicionais", "adicional", "complementos", "complemento"];

function normalize(name: unknown): string {
  return String(name ?? "")
    .trim()
    .toLowerCase();
}

export function isBordasCategory(category: { name: string }): boolean {
  return BORDAS_NAMES.includes(normalize(category.name));
}

export function isAdicionaisCategory(category: { name: string }): boolean {
  return ADICIONAIS_NAMES.includes(normalize(category.name));
}

/**
 * Bordas e adicionais não são seções do cardápio: são escolhas que aparecem
 * dentro do produto. Quem for listar seções deve descartar as duas.
 */
export function isExtrasCategory(category: { name: string }): boolean {
  return isBordasCategory(category) || isAdicionaisCategory(category);
}
