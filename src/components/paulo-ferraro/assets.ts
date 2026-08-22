/**
 * PAULO FERRARO — imagens do site.
 *
 * COMO COLOCAR A FOTOGRAFIA NO SITE
 * ---------------------------------
 * Basta salvar o arquivo dentro da pasta `src/assets/` com um destes nomes:
 *
 *   src/assets/paulo-ferraro-hero.png    → fotografia principal (PNG recortado,
 *                                          fundo transparente, Full HD)
 *   src/assets/paulo-ferraro-sobre.jpg   → segunda fotografia (seção "Sobre")
 *   src/assets/paulo-ferraro-og.jpg      → imagem de compartilhamento em redes
 *                                          sociais (1200x630 px)
 *
 * Nada mais precisa ser alterado: o site encontra o arquivo sozinho, gera as
 * versões otimizadas e passa a exibi-lo. Enquanto o arquivo não existir, o site
 * mostra no lugar um espaço reservado, com o aviso de que a foto está faltando.
 * O PNG original é usado como está — sem corte, filtro ou reprocessamento.
 *
 * Detalhe técnico: `import.meta.glob` faz o site procurar o arquivo no momento
 * da compilação. Se ele não estiver lá, a lista volta vazia e nada quebra — é
 * diferente de um "import" comum, que derrubaria a compilação inteira.
 */

type ModuloImagem = Record<string, string>;

function primeiraImagem(modulos: ModuloImagem): string | null {
  const caminhos = Object.keys(modulos).sort();
  return caminhos.length > 0 ? modulos[caminhos[0]] : null;
}

const heroModules = import.meta.glob("../../assets/paulo-ferraro-hero.{png,webp,jpg,jpeg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as ModuloImagem;

const sobreModules = import.meta.glob("../../assets/paulo-ferraro-sobre.{png,webp,jpg,jpeg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as ModuloImagem;

// Imagem que aparece quando alguém compartilha o link no WhatsApp, no
// Instagram, no LinkedIn ou no Facebook. Formato recomendado: 1200x630 px.
const compartilharModules = import.meta.glob("../../assets/paulo-ferraro-og.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as ModuloImagem;

/** Endereço da fotografia principal do Hero, ou `null` se ainda não foi enviada. */
export const fotoHero: string | null = primeiraImagem(heroModules);

/** Endereço da fotografia da seção "Sobre", ou `null` se ainda não foi enviada. */
export const fotoSobre: string | null = primeiraImagem(sobreModules);

/**
 * Imagem de compartilhamento, ou `null` enquanto ela não existir. Sem ela, o
 * site não anuncia imagem nenhuma — melhor um link limpo do que um link com o
 * quadrado cinza de "imagem não encontrada".
 */
export const imagemCompartilhamento: string | null = primeiraImagem(compartilharModules);

/** Caminhos esperados — exibidos na tela do espaço reservado. */
export const CAMINHO_FOTO_HERO = "src/assets/paulo-ferraro-hero.png";
export const CAMINHO_FOTO_SOBRE = "src/assets/paulo-ferraro-sobre.jpg";
