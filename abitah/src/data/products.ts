import type { Product, ProductVariant } from "@/types/catalog";
import { demoCategories } from "@/data/categories";

/**
 * Catálogo de DEMONSTRAÇÃO.
 * Usado automaticamente quando o Supabase ainda não está configurado, ou como
 * conteúdo inicial de seed (veja supabase/seed.sql). Todos os itens são
 * marcados com `isDemo: true` e aparecem no painel com o selo "Demonstração".
 */

export const COLORS = {
  preto: { name: "Preto", hex: "#0A0A0A" },
  grafite: { name: "Grafite", hex: "#2E3532" },
  branco: { name: "Branco", hex: "#F5F6F5" },
  neon: { name: "Verde Neon", hex: "#29E23D" },
  chumbo: { name: "Chumbo", hex: "#4A524E" },
} as const;

export const APPAREL_SIZES = ["P", "M", "G", "GG", "XGG"];
export const ONE_SIZE = ["Único"];

const DEFAULT_CARE = [
  "Lave à máquina em água fria, com peças de cores semelhantes",
  "Não use alvejante ou amaciante em excesso",
  "Seque à sombra — evite secadora em alta temperatura",
  "Passe em temperatura baixa, do avesso, sem passar sobre a estampa",
];

const DEFAULT_SIZE_GUIDE = [
  { size: "P", chest: "94 cm", waist: "78 cm", length: "68 cm" },
  { size: "M", chest: "100 cm", waist: "84 cm", length: "70 cm" },
  { size: "G", chest: "106 cm", waist: "90 cm", length: "72 cm" },
  { size: "GG", chest: "112 cm", waist: "96 cm", length: "74 cm" },
  { size: "XGG", chest: "118 cm", waist: "102 cm", length: "76 cm" },
];

type ColorKey = keyof typeof COLORS;

type ProductSeed = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  categorySlug: string;
  subcategory?: string;
  price: number;
  salePrice?: number;
  costPrice?: number;
  material: string;
  sizes: string[];
  colors: ColorKey[];
  stockPerVariant?: number;
  weightGrams: number;
  isFeatured?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  salesCount?: number;
  imageCount?: number;
};

function buildVariants(
  slug: string,
  sizes: string[],
  colors: ColorKey[],
  stockPerVariant: number,
): ProductVariant[] {
  const variants: ProductVariant[] = [];
  colors.forEach((colorKey, colorIndex) => {
    sizes.forEach((size, sizeIndex) => {
      // Estoque variado para tornar a demonstração realista (algumas grades zeradas).
      const offset = (colorIndex * 3 + sizeIndex * 2) % 7;
      const stock = Math.max(0, stockPerVariant - offset);
      variants.push({
        id: `${slug}-${colorKey}-${size}`.toLowerCase(),
        size,
        color: COLORS[colorKey].name,
        colorHex: COLORS[colorKey].hex,
        sku: `${slug.slice(0, 6).toUpperCase()}-${colorKey.slice(0, 3).toUpperCase()}-${size}`,
        stock,
        priceDelta: 0,
      });
    });
  });
  return variants;
}

function buildProduct(seed: ProductSeed, index: number): Product {
  const category = demoCategories.find((c) => c.slug === seed.categorySlug);
  if (!category) throw new Error(`Categoria inexistente: ${seed.categorySlug}`);

  const imageCount = seed.imageCount ?? 4;
  const createdAt = new Date(Date.UTC(2025, 0, 1) + index * 86_400_000 * 6).toISOString();

  return {
    id: `demo-${seed.slug}`,
    slug: seed.slug,
    name: seed.name,
    shortDescription: seed.shortDescription,
    description: seed.description,
    categorySlug: category.slug,
    categoryName: category.name,
    group: category.group,
    subcategory: seed.subcategory ?? null,
    price: seed.price,
    salePrice: seed.salePrice ?? null,
    costPrice: seed.costPrice ?? null,
    sku: `ABT-${String(index + 1).padStart(4, "0")}`,
    barcode: null,
    material: seed.material,
    care: DEFAULT_CARE,
    sizeGuide: seed.sizes.length > 1 ? DEFAULT_SIZE_GUIDE : [],
    dimensions: {
      weightGrams: seed.weightGrams,
      heightCm: 6,
      widthCm: 26,
      lengthCm: 34,
    },
    images: Array.from({ length: imageCount }, (_, i) => ({
      id: `${seed.slug}-img-${i}`,
      url: null,
      alt: `${seed.name} — imagem ${i + 1}`,
      position: i,
      isPrimary: i === 0,
    })),
    variants: buildVariants(seed.slug, seed.sizes, seed.colors, seed.stockPerVariant ?? 12),
    isFeatured: seed.isFeatured ?? false,
    isNew: seed.isNew ?? false,
    isBestSeller: seed.isBestSeller ?? false,
    isActive: true,
    isDemo: true,
    salesCount: seed.salesCount ?? 0,
    createdAt,
  };
}

const seeds: ProductSeed[] = [
  {
    slug: "camiseta-oversized-oficial",
    name: "Camiseta Oversized Oficial",
    shortDescription: "Caimento amplo, algodão pesado e assinatura ABITAH nas costas.",
    description:
      "A Camiseta Oversized Oficial é a peça de entrada da comunidade ABITAH. Confeccionada em algodão penteado de gramatura alta, ela mantém o caimento estruturado mesmo depois de muitas lavagens. O corte oversized dá liberdade nos movimentos de ombro e um visual streetwear que funciona dentro e fora da academia. Aplicação da marca em silk de alta durabilidade, resistente ao suor e ao atrito da barra.",
    categorySlug: "camisetas",
    subcategory: "Oversized",
    price: 89.9,
    costPrice: 34.5,
    material: "100% algodão penteado 30.1 — gramatura 185g/m²",
    sizes: APPAREL_SIZES,
    colors: ["preto", "grafite", "branco"],
    weightGrams: 260,
    isFeatured: true,
    isNew: true,
    isBestSeller: true,
    salesCount: 412,
  },
  {
    slug: "camiseta-dry-fit-performance",
    name: "Camiseta Dry Fit Performance",
    shortDescription: "Tecido tecnológico que afasta o suor e seca em minutos.",
    description:
      "Desenvolvida para os treinos mais intensos, a Dry Fit Performance usa malha em poliamida com canais de ventilação nas laterais e nas costas. O tecido puxa a umidade para a superfície externa, acelerando a evaporação e mantendo a peça leve mesmo no final da sessão. Costuras planas evitam atrito em séries longas de puxada e supino.",
    categorySlug: "camisetas",
    subcategory: "Performance",
    price: 79.9,
    salePrice: 64.9,
    costPrice: 29.9,
    material: "88% poliamida · 12% elastano com tratamento antiodor",
    sizes: APPAREL_SIZES,
    colors: ["preto", "chumbo", "neon"],
    weightGrams: 180,
    isFeatured: true,
    isBestSeller: true,
    salesCount: 388,
  },
  {
    slug: "regata-training",
    name: "Regata Training",
    shortDescription: "Cava ampla e leveza absoluta para os dias de força.",
    description:
      "A Regata Training foi desenhada para quem treina pesado e precisa de amplitude total nos ombros. A cava alongada libera o movimento em desenvolvimentos e remadas, enquanto a malha leve garante ventilação constante. O acabamento em ribana reforçada mantém a gola firme depois de dezenas de lavagens.",
    categorySlug: "regatas",
    price: 69.9,
    costPrice: 24.9,
    material: "60% algodão · 40% poliéster — malha leve 160g/m²",
    sizes: APPAREL_SIZES,
    colors: ["preto", "branco", "grafite"],
    weightGrams: 165,
    isNew: true,
    isBestSeller: true,
    salesCount: 297,
  },
  {
    slug: "short-masculino-performance",
    name: "Short Masculino Performance",
    shortDescription: "Bolsos com zíper, cordão interno e secagem rápida.",
    description:
      "Short de treino com tecido leve e forro em compressão que evita atrito em corridas e agachamentos. Traz dois bolsos laterais com zíper para chave e celular, cordão interno ajustável e recorte lateral que amplia a passada. Ideal para funcional, corrida e treino de pernas.",
    categorySlug: "shorts",
    price: 99.9,
    costPrice: 38,
    material: "Poliéster microfibra com forro em elastano",
    sizes: APPAREL_SIZES,
    colors: ["preto", "grafite", "chumbo"],
    weightGrams: 210,
    isFeatured: true,
    isNew: true,
    salesCount: 214,
  },
  {
    slug: "legging-feminina-high-performance",
    name: "Legging Feminina High Performance",
    shortDescription: "Cintura alta, compressão firme e tecido que não fica transparente.",
    description:
      "A Legging High Performance combina cintura alta com compressão progressiva, sustentando o abdômen sem apertar. O tecido de gramatura elevada tem teste de opacidade aprovado no agachamento profundo, e o bolso lateral acomoda o celular com estabilidade. Costura ergonômica no gluteo valoriza o contorno natural.",
    categorySlug: "calcas-e-leggings",
    subcategory: "Feminino",
    price: 129.9,
    salePrice: 109.9,
    costPrice: 46,
    material: "72% poliamida · 28% elastano — gramatura 280g/m²",
    sizes: APPAREL_SIZES,
    colors: ["preto", "grafite", "chumbo"],
    weightGrams: 240,
    isFeatured: true,
    isBestSeller: true,
    salesCount: 501,
  },
  {
    slug: "top-esportivo-training",
    name: "Top Esportivo Training",
    shortDescription: "Sustentação média com alças ajustáveis e costas nadador.",
    description:
      "Top de sustentação média pensado para musculação e treinos funcionais. As alças ajustáveis permitem regular a firmeza, e o recorte nas costas amplia o movimento dos ombros. Bojo removível e faixa elástica sob o busto garantem estabilidade sem marcar.",
    categorySlug: "calcas-e-leggings",
    subcategory: "Feminino",
    price: 89.9,
    costPrice: 32,
    material: "80% poliamida · 20% elastano com bojo removível",
    sizes: APPAREL_SIZES,
    colors: ["preto", "branco", "neon"],
    weightGrams: 140,
    isNew: true,
    salesCount: 176,
  },
  {
    slug: "moletom-oficial",
    name: "Moletom Oficial",
    shortDescription: "Flanelado por dentro, capuz duplo e bordado da marca.",
    description:
      "O Moletom Oficial é a peça de aquecimento da comunidade. Moletom flanelado de gramatura alta, com capuz duplo, punhos em ribana canelada e bolso canguru forrado. O logotipo é aplicado em bordado de alta densidade, mantendo o relevo mesmo após muitas lavagens.",
    categorySlug: "moletons",
    price: 189.9,
    salePrice: 159.9,
    costPrice: 72,
    material: "Moletom flanelado 320g/m² — 80% algodão · 20% poliéster",
    sizes: APPAREL_SIZES,
    colors: ["preto", "grafite", "chumbo"],
    weightGrams: 620,
    isFeatured: true,
    isBestSeller: true,
    salesCount: 268,
  },
  {
    slug: "bone-oficial",
    name: "Boné Oficial",
    shortDescription: "Aba curva, fecho regulável e bordado frontal em relevo.",
    description:
      "Boné estruturado com aba curva e seis gomos ventilados. O fecho metálico regulável acomoda diferentes tamanhos e a faixa interna absorve o suor durante o treino ao ar livre. Bordado frontal em relevo com o símbolo ABITAH.",
    categorySlug: "bones",
    price: 69.9,
    costPrice: 22,
    material: "Sarja de algodão com forro interno absorvente",
    sizes: ONE_SIZE,
    colors: ["preto", "grafite", "branco"],
    stockPerVariant: 30,
    weightGrams: 120,
    isNew: true,
    salesCount: 143,
  },
  {
    slug: "garrafa-esportiva",
    name: "Garrafa Esportiva",
    shortDescription: "700 ml, livre de BPA, com marcação de volume e bico esportivo.",
    description:
      "Garrafa de 700 ml em material resistente e livre de BPA, com marcação lateral de volume para acompanhar a hidratação ao longo do dia. O bico esportivo com trava evita vazamentos na mochila e o corpo levemente texturizado melhora a pegada com as mãos suadas.",
    categorySlug: "garrafas-e-coqueteleiras",
    price: 49.9,
    costPrice: 16,
    material: "Tritan livre de BPA · 700 ml",
    sizes: ONE_SIZE,
    colors: ["preto", "neon", "branco"],
    stockPerVariant: 40,
    weightGrams: 190,
    isBestSeller: true,
    salesCount: 322,
  },
  {
    slug: "coqueteleira-oficial",
    name: "Coqueteleira Oficial",
    shortDescription: "600 ml com mola misturadora e tampa com trava de segurança.",
    description:
      "Coqueteleira de 600 ml com mola misturadora em aço inox que dissolve o suplemento sem grumos. A tampa possui trava de segurança e vedação em silicone, e o corpo graduado facilita a dosagem. Compatível com lava-louças.",
    categorySlug: "garrafas-e-coqueteleiras",
    price: 39.9,
    costPrice: 12.5,
    material: "Polipropileno atóxico com mola em aço inox · 600 ml",
    sizes: ONE_SIZE,
    colors: ["preto", "neon"],
    stockPerVariant: 45,
    weightGrams: 160,
    isNew: true,
    salesCount: 289,
  },
  {
    slug: "mochila-training",
    name: "Mochila Training",
    shortDescription: "Compartimento para tênis, bolso térmico e costas ventiladas.",
    description:
      "Mochila de 28 litros pensada para a rotina academia-trabalho. Traz compartimento inferior isolado para tênis, bolso térmico para a marmita, divisória acolchoada para notebook de até 15 polegadas e alças com espuma respirável. Tecido com tratamento repelente a água.",
    categorySlug: "mochilas-e-acessorios",
    price: 149.9,
    salePrice: 129.9,
    costPrice: 58,
    material: "Poliéster 600D com revestimento repelente",
    sizes: ONE_SIZE,
    colors: ["preto", "grafite"],
    stockPerVariant: 25,
    weightGrams: 780,
    isFeatured: true,
    isBestSeller: true,
    salesCount: 231,
  },
  {
    slug: "munhequeira-esportiva",
    name: "Munhequeira Esportiva",
    shortDescription: "Par com velcro reforçado e apoio firme para cargas altas.",
    description:
      "Par de munhequeiras com faixa elástica de alta compressão e velcro reforçado, estabilizando o punho em supino, desenvolvimento e movimentos olímpicos. O laço de polegar facilita o ajuste antes da série e o acabamento antiabrasivo protege a pele.",
    categorySlug: "mochilas-e-acessorios",
    price: 29.9,
    costPrice: 9,
    material: "Algodão elástico com velcro reforçado — par",
    sizes: ONE_SIZE,
    colors: ["preto", "neon", "branco"],
    stockPerVariant: 60,
    weightGrams: 110,
    isNew: true,
    salesCount: 198,
  },
  {
    slug: "camiseta-manga-longa-uv",
    name: "Camiseta Manga Longa UV",
    shortDescription: "Proteção UV 50+ para treinos ao ar livre.",
    description:
      "Manga longa com proteção solar UV 50+, indicada para corrida, funcional outdoor e treinos ao ar livre. O tecido leve tem toque frio e polegueira nos punhos, mantendo as mangas no lugar durante o movimento.",
    categorySlug: "camisetas",
    subcategory: "Outdoor",
    price: 109.9,
    costPrice: 41,
    material: "Poliamida com proteção UV 50+ e toque gelado",
    sizes: APPAREL_SIZES,
    colors: ["preto", "chumbo", "branco"],
    weightGrams: 190,
    isNew: true,
    salesCount: 87,
  },
  {
    slug: "regata-cavada-power",
    name: "Regata Cavada Power",
    shortDescription: "Cava profunda para amplitude máxima no treino de costas.",
    description:
      "Regata de cava profunda para quem prioriza amplitude total em puxadas e remadas. Malha leve com toque seco e barra arredondada que acompanha o movimento sem subir.",
    categorySlug: "regatas",
    price: 74.9,
    salePrice: 59.9,
    costPrice: 26,
    material: "Malha PV leve com toque seco",
    sizes: APPAREL_SIZES,
    colors: ["preto", "grafite", "neon"],
    weightGrams: 155,
    isNew: true,
    salesCount: 121,
  },
  {
    slug: "short-feminino-essential",
    name: "Short Feminino Essential",
    shortDescription: "Cintura alta com compressão leve e bolso interno.",
    description:
      "Short de cintura alta com compressão leve, ideal para musculação e treinos funcionais. O cós largo não enrola e o bolso interno acomoda cartão ou chave. Tecido de secagem rápida com teste de opacidade aprovado.",
    categorySlug: "shorts",
    subcategory: "Feminino",
    price: 89.9,
    costPrice: 33,
    material: "76% poliamida · 24% elastano",
    sizes: APPAREL_SIZES,
    colors: ["preto", "grafite", "chumbo"],
    weightGrams: 150,
    isNew: true,
    salesCount: 164,
  },
  {
    slug: "calca-jogger-training",
    name: "Calça Jogger Training",
    shortDescription: "Punho elástico, tecido leve e bolsos com zíper.",
    description:
      "Jogger de treino em tecido leve com elastano, punho elástico e bolsos laterais com zíper. Excelente para aquecimento, deslocamento e dias frios sem perder mobilidade nos agachamentos.",
    categorySlug: "calcas-e-leggings",
    price: 159.9,
    costPrice: 62,
    material: "Poliéster com elastano e tratamento antipilling",
    sizes: APPAREL_SIZES,
    colors: ["preto", "grafite"],
    weightGrams: 380,
    isFeatured: true,
    salesCount: 133,
  },
  {
    slug: "moletom-cropped-community",
    name: "Moletom Cropped Community",
    shortDescription: "Corte cropped, capuz amplo e assinatura da comunidade.",
    description:
      "Moletom cropped com capuz amplo e barra em ribana, pensado para o pré-treino e para o dia a dia. Aplicação discreta da marca no peito e etiqueta interna com o manifesto da comunidade ABITAH.",
    categorySlug: "moletons",
    subcategory: "Feminino",
    price: 169.9,
    costPrice: 64,
    material: "Moletom flanelado 300g/m²",
    sizes: APPAREL_SIZES,
    colors: ["preto", "chumbo", "branco"],
    weightGrams: 480,
    isNew: true,
    salesCount: 118,
  },
  {
    slug: "bone-trucker-neon",
    name: "Boné Trucker Neon",
    shortDescription: "Tela traseira ventilada com detalhe em verde neon.",
    description:
      "Boné modelo trucker com frente estruturada e tela traseira ventilada, perfeito para treinos ao ar livre e dias quentes. Detalhe em verde neon na costura e fecho snapback regulável.",
    categorySlug: "bones",
    price: 79.9,
    salePrice: 64.9,
    costPrice: 24,
    material: "Frente em sarja e traseira em tela ventilada",
    sizes: ONE_SIZE,
    colors: ["preto", "neon"],
    stockPerVariant: 28,
    weightGrams: 110,
    isNew: true,
    salesCount: 96,
  },
  {
    slug: "garrafa-termica-inox",
    name: "Garrafa Térmica Inox",
    shortDescription: "Parede dupla que mantém a temperatura por até 12 horas.",
    description:
      "Garrafa térmica de 750 ml em aço inox com parede dupla a vácuo, mantendo bebidas geladas por até 12 horas. Tampa rosqueável com vedação em silicone e pintura texturizada antideslizante.",
    categorySlug: "garrafas-e-coqueteleiras",
    price: 119.9,
    costPrice: 44,
    material: "Aço inox 304 com isolamento a vácuo · 750 ml",
    sizes: ONE_SIZE,
    colors: ["preto", "grafite"],
    stockPerVariant: 22,
    weightGrams: 420,
    isFeatured: true,
    salesCount: 154,
  },
  {
    slug: "necessaire-gym-bag",
    name: "Necessaire Gym Bag",
    shortDescription: "Bolsa compacta para acessórios, cinto e suplementos.",
    description:
      "Bolsa compacta para organizar cinto, luvas, straps e potes de suplemento dentro da mochila. Possui divisória interna, bolso com tela e alça de mão reforçada.",
    categorySlug: "mochilas-e-acessorios",
    price: 59.9,
    costPrice: 19,
    material: "Poliéster 600D com forro impermeável",
    sizes: ONE_SIZE,
    colors: ["preto", "grafite", "neon"],
    stockPerVariant: 35,
    weightGrams: 210,
    isNew: true,
    salesCount: 74,
  },
];

export const demoProducts: Product[] = seeds.map(buildProduct);

export const demoCoupons = [
  {
    id: "coupon-comunidade10",
    code: "COMUNIDADE10",
    type: "percent" as const,
    value: 10,
    minOrderValue: 149,
    active: true,
    expiresAt: null,
    description: "10% de desconto em compras acima de R$ 149,00",
  },
  {
    id: "coupon-primeirotreino",
    code: "PRIMEIROTREINO",
    type: "fixed" as const,
    value: 25,
    minOrderValue: 199,
    active: true,
    expiresAt: null,
    description: "R$ 25,00 de desconto na primeira compra acima de R$ 199,00",
  },
  {
    id: "coupon-freteoff",
    code: "ABITAH15",
    type: "percent" as const,
    value: 15,
    minOrderValue: 299,
    active: true,
    expiresAt: null,
    description: "15% de desconto em compras acima de R$ 299,00",
  },
];

export const demoBanners = [
  {
    id: "banner-hero",
    key: "home_hero",
    title: "TREINE FORTE. VISTA SUA IDENTIDADE.",
    subtitle: "Roupas e acessórios oficiais para quem leva o treino além dos limites.",
    ctaLabel: "Conhecer coleção",
    ctaHref: "/loja",
    imageUrl: null,
    active: true,
    position: 1,
  },
  {
    id: "banner-community",
    key: "home_community",
    title: "Não é apenas uma marca. É o uniforme de quem não desiste.",
    subtitle:
      "Cada peça carrega a rotina de quem treina de verdade: disciplina, constância e pertencimento.",
    ctaLabel: "Conhecer nossa história",
    ctaHref: "/sobre",
    imageUrl: null,
    active: true,
    position: 2,
  },
];
