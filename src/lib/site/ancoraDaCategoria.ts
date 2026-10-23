/**
 * O endereço de cada bloco de categoria dentro da página do cardápio. A barra
 * de categorias pula para ele, e o bloco usa o mesmo nome — os dois lados
 * precisam concordar, como a etiqueta da prateleira e a do corredor.
 */
export function ancoraDaCategoria(id: string): string {
  return `categoria-${id}`;
}
