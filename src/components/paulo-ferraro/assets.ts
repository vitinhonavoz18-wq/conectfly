/**
 * PAULO FERRARO — imagens do site.
 *
 * COMO COLOCAR A FOTOGRAFIA NO SITE
 * ---------------------------------
 * Basta salvar o arquivo dentro da pasta `src/assets/` com um destes nomes:
 *
 *   src/assets/paulo-ferraro-hero.png    → fotografia principal (PNG recortado,
 *                                          fundo transparente, Full HD)
 *   src/assets/paulo-ferraro-sobre.png   → segunda fotografia (seção "Sobre"),
 *                                          também recortada, sem fundo
 *   src/assets/paulo-ferraro-logo.png    → logo oficial
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

/**
 * LOGO OFICIAL — a assinatura que aparece no cabeçalho, no menu e no rodapé.
 *
 * O arquivo em uso é a versão reduzida da logo: monograma + barra + "PAULO
 * FERRARO", sem o fio e sem a linha miúda "ADVOCACIA E CONSULTORIA JURÍDICA".
 *
 * O motivo é de leitura, não de gosto. A logo inteira tem 4,3 vezes mais
 * largura do que altura. Numa barra de cabeçalho de 46 px de altura, aquela
 * linha miúda fica com 5 px — a mesma coisa que imprimir o endereço do
 * restaurante em letra de bula no rodapé do cardápio: está lá, mas ninguém lê,
 * e o que aparece é uma mancha cinza embaixo do nome.
 *
 * Então a frase saiu da imagem e virou texto de verdade no rodapé (veja
 * `perfil.descritor`). Nada se perdeu: a informação continua no site, agora
 * legível em qualquer tamanho e encontrável pelo Google.
 *
 * A logo completa, com a linha miúda, está guardada em
 * `src/assets/originais/paulo-ferraro-logo-completa.webp` — é a versão para
 * cartão de visita, papel timbrado e perfil de rede social.
 */
const logoModules = import.meta.glob("../../assets/paulo-ferraro-logo.{webp,png,jpg,jpeg}", {
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
 * Endereço da logo, ou `null` se o arquivo sumir da pasta. Nesse caso o site
 * volta sozinho a escrever o nome em letra serifada, como fazia antes de a
 * logo chegar — o cabeçalho nunca fica sem assinatura.
 */
export const logoMarca: string | null = melhorImagem(logoModules);

/**
 * Tamanho real do arquivo da logo, em pixels.
 *
 * Vai escrito na página para o navegador reservar o espaço certo antes de a
 * imagem chegar. Sem isso, o cabeçalho "pula" no momento em que a logo carrega
 * — como uma mesa que anda de lugar depois que o garçom já sentou o cliente.
 */
export const LOGO_LARGURA = 660;
export const LOGO_ALTURA = 152;

/**
 * Imagem de compartilhamento, ou `null` enquanto ela não existir. Sem ela, o
 * site não anuncia imagem nenhuma — melhor um link limpo do que um link com o
 * quadrado cinza de "imagem não encontrada".
 */
export const imagemCompartilhamento: string | null = melhorImagem(compartilharModules);

/** Caminhos esperados — exibidos na tela do espaço reservado. */
export const CAMINHO_FOTO_HERO = "src/assets/paulo-ferraro-hero.png";
export const CAMINHO_FOTO_SOBRE = "src/assets/paulo-ferraro-sobre.png";
