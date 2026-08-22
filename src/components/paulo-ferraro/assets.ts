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

/**
 * Ordem de preferência dos formatos.
 *
 * O WebP guarda a mesma foto com uma fração do peso: a fotografia do advogado
 * tem 1,9 MB em PNG e 271 KB em WebP — sem diferença visível na tela. Em
 * conexão de celular, é a diferença entre a foto aparecer na hora e a pessoa
 * olhar para um espaço vazio por alguns segundos.
 *
 * O PNG original continua guardado na pasta como matriz: é dele que sai
 * qualquer versão futura. Ele só não é o arquivo entregue ao visitante — como
 * o negativo da foto, que fica no arquivo enquanto a cópia vai para a moldura.
 */
const PREFERENCIA = [".webp", ".jpg", ".jpeg", ".png"];

function melhorImagem(modulos: ModuloImagem): string | null {
  const caminhos = Object.keys(modulos);
  if (caminhos.length === 0) return null;

  for (const extensao of PREFERENCIA) {
    const achado = caminhos.find((caminho) => caminho.toLowerCase().endsWith(extensao));
    if (achado) return modulos[achado];
  }
  return modulos[caminhos.sort()[0]];
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
export const fotoHero: string | null = melhorImagem(heroModules);

/** Endereço da fotografia da seção "Sobre", ou `null` se ainda não foi enviada. */
export const fotoSobre: string | null = melhorImagem(sobreModules);

/**
 * Imagem de compartilhamento, ou `null` enquanto ela não existir. Sem ela, o
 * site não anuncia imagem nenhuma — melhor um link limpo do que um link com o
 * quadrado cinza de "imagem não encontrada".
 */
export const imagemCompartilhamento: string | null = melhorImagem(compartilharModules);

/** Caminhos esperados — exibidos na tela do espaço reservado. */
export const CAMINHO_FOTO_HERO = "src/assets/paulo-ferraro-hero.png";
export const CAMINHO_FOTO_SOBRE = "src/assets/paulo-ferraro-sobre.jpg";
