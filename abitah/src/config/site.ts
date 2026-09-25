/**
 * ---------------------------------------------------------------------------
 * CONFIGURAÇÕES CENTRAIS DA LOJA
 * ---------------------------------------------------------------------------
 * Este é o único arquivo que precisa ser editado para trocar dados da empresa:
 * nome, contatos, redes sociais, endereço, frete, textos institucionais.
 *
 * Valores sensíveis (chaves de API) NUNCA ficam aqui — use variáveis de
 * ambiente (.env.local). Veja .env.example.
 * ---------------------------------------------------------------------------
 */

export const siteConfig = {
  /** Nome exatamente como aparece na logo oficial. */
  name: "ABITAH",
  legalName: "ABITAH Academia & Wear",
  tagline: "Treine forte. Vista sua identidade.",
  description:
    "Loja oficial ABITAH. Roupas e acessórios esportivos criados para quem treina de verdade. Performance, estilo e pertencimento em cada peça.",

  /** URL pública (usada em SEO, sitemap e links do WhatsApp). */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://abitah.com.br",

  /** Arquivos da logo dentro de /public — troque os arquivos, não o código. */
  logo: {
    /** Lockup horizontal — usado no cabeçalho. */
    horizontal: "/brand/abitah-logo-horizontal.svg",
    /** Versão empilhada sobre fundo escuro (rodapé, páginas). */
    full: "/brand/abitah-logo-light.svg",
    /** Versão original, para fundo claro (e-mails, notas, impressos). */
    onLight: "/brand/abitah-logo.svg",
    /** Somente o símbolo. */
    mark: "/brand/abitah-mark.svg",
  },

  /**
   * Hero editorial da página inicial.
   * Basta soltar o arquivo do produto (PNG/WEBP com fundo transparente,
   * mínimo 1600x1600) em /public/products/ com este nome. Enquanto o arquivo
   * não existir, o hero mostra um placeholder com a mesma proporção.
   */
  hero: {
    productImage: "/products/hero-product.png",
    eyebrow: "Coleção oficial da academia",
    title: "FEITO PARA QUEM VAI ALÉM.",
    description:
      "Roupas e acessórios oficiais para quem transforma treino em estilo de vida.",
    collection: {
      eyebrow: "Nova coleção",
      name: "Linha Performance 2026",
      description: "Performance, conforto e identidade dentro e fora da academia.",
      href: "/lancamentos",
    },
    stats: [
      { value: "+2.400", label: "Alunos vestindo" },
      { value: "100%", label: "Produção nacional" },
      { value: "4,9", label: "Avaliação média" },
    ],
  },

  contact: {
    /**
     * WhatsApp em formato internacional, apenas dígitos: 55 + DDD + número.
     * Pode ser sobrescrito por NEXT_PUBLIC_WHATSAPP_NUMBER no .env.local
     */
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5511999999999",
    whatsappLabel: "(11) 99999-9999",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contato@abitah.com.br",
    phone: "(11) 99999-9999",
    address: {
      street: "Av. das Palmeiras, 1200",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
      zip: "01000-000",
      /** Endereço usado no mapa. Troque pelo endereço oficial. */
      mapQuery: "Av. das Palmeiras, 1200 - Centro, São Paulo - SP",
    },
    hours: [
      { days: "Segunda a sexta", time: "06h00 às 22h00" },
      { days: "Sábado", time: "08h00 às 16h00" },
      { days: "Domingo e feriados", time: "08h00 às 12h00" },
    ],
  },

  social: {
    instagram: "https://instagram.com/abitah",
    instagramHandle: "@abitah",
    facebook: "https://facebook.com/abitah",
    youtube: "",
    tiktok: "",
  },

  commerce: {
    currency: "BRL",
    locale: "pt-BR",
    /** Número máximo de parcelas sem juros exibido nos cards. */
    maxInstallments: 6,
    /** Valor mínimo de cada parcela (R$). */
    minInstallmentValue: 20,
    /** Frete grátis a partir deste valor (R$). Use 0 para desativar. */
    freeShippingThreshold: 299,
    /** Valores usados na estimativa de frete enquanto não há integração. */
    shipping: {
      standard: { label: "Entrega padrão", price: 24.9, eta: "5 a 9 dias úteis" },
      express: { label: "Entrega expressa", price: 39.9, eta: "2 a 4 dias úteis" },
      pickup: { label: "Retirar na academia", price: 0, eta: "Disponível em até 24h" },
    },
    /**
     * Métodos de pagamento REALMENTE disponíveis hoje.
     * Enquanto o gateway não estiver integrado, mantenha apenas "whatsapp".
     * Ao integrar, adicione: "pix" | "credit_card" | "mercado_pago" | "stripe".
     */
    enabledPaymentMethods: ["whatsapp"] as const,
  },

  /** Textos institucionais editáveis (página Sobre / banners). */
  institutional: {
    communityHeadline: "Não é apenas uma marca. É o uniforme de quem não desiste.",
    communityText:
      "A ABITAH nasceu dentro da academia, no chão de treino, entre séries pesadas e recordes pessoais. Cada peça é testada por quem vive a rotina de verdade — e vestida por uma comunidade que entende que resultado é consequência de constância.",
    newsletterHeadline: "Receba lançamentos, condições especiais e novidades da nossa comunidade.",
  },

  /** Prazo padrão informado na página de produto. */
  policies: {
    exchangeDays: 7,
    returnDays: 30,
    dispatchTime: "Postagem em até 2 dias úteis",
  },
} as const;

export type SiteConfig = typeof siteConfig;

/** Link do WhatsApp já formatado com mensagem opcional. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${siteConfig.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
