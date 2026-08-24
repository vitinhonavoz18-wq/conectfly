import { siteConfig } from "@/config/site";

export type PolicyDocument = {
  slug: string;
  title: string;
  summary: string;
  updatedAt: string;
  sections: { heading: string; paragraphs: string[] }[];
};

/* Textos institucionais provisórios, prontos para revisão jurídica.
   Edite livremente — nenhuma outra parte do código depende do conteúdo. */

export const policies: PolicyDocument[] = [
  {
    slug: "privacidade",
    title: "Política de privacidade",
    summary:
      "Como coletamos, usamos e protegemos os seus dados pessoais ao navegar e comprar em nossa loja.",
    updatedAt: "2026-01-15",
    sections: [
      {
        heading: "1. Quais dados coletamos",
        paragraphs: [
          `Coletamos apenas os dados necessários para processar o seu pedido e prestar atendimento: nome, e-mail, telefone, CPF (quando informado) e endereço de entrega.`,
          "Também registramos dados de navegação, como páginas visitadas e produtos visualizados, para melhorar a experiência da loja. Esses registros não identificam você individualmente.",
        ],
      },
      {
        heading: "2. Como usamos os dados",
        paragraphs: [
          "Os dados são usados para: identificar você, processar e entregar pedidos, emitir documentos fiscais, responder solicitações de atendimento e, quando autorizado, enviar novidades e condições especiais.",
          "Não vendemos, alugamos ou cedemos seus dados pessoais a terceiros para fins comerciais.",
        ],
      },
      {
        heading: "3. Compartilhamento necessário",
        paragraphs: [
          "Compartilhamos apenas o indispensável com parceiros que viabilizam a operação: transportadoras, meios de pagamento e provedores de tecnologia. Todos estão sujeitos a obrigações de confidencialidade.",
        ],
      },
      {
        heading: "4. Seus direitos",
        paragraphs: [
          "Conforme a Lei Geral de Proteção de Dados (LGPD), você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados, além de revogar consentimentos concedidos.",
          `Para exercer qualquer direito, escreva para ${siteConfig.contact.email} ou fale com a equipe pelo WhatsApp ${siteConfig.contact.whatsappLabel}.`,
        ],
      },
      {
        heading: "5. Segurança e retenção",
        paragraphs: [
          "Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou alteração indevida.",
          "Mantemos os dados apenas pelo período necessário ao cumprimento das finalidades descritas e das obrigações legais aplicáveis.",
        ],
      },
    ],
  },
  {
    slug: "trocas",
    title: "Política de troca e devolução",
    summary:
      "Prazos, condições e o passo a passo para trocar tamanho, cor ou solicitar devolução.",
    updatedAt: "2026-01-15",
    sections: [
      {
        heading: "1. Prazo para troca",
        paragraphs: [
          `Você tem até ${siteConfig.policies.exchangeDays} dias corridos, contados do recebimento, para solicitar troca de tamanho ou cor.`,
          "A primeira troca por tamanho é gratuita: enviamos o código de postagem e a nova peça assim que recebermos a original.",
        ],
      },
      {
        heading: "2. Devolução por arrependimento",
        paragraphs: [
          `Conforme o Código de Defesa do Consumidor, compras online podem ser devolvidas em até 7 dias. Nós ampliamos esse prazo para ${siteConfig.policies.returnDays} dias.`,
          "O valor é devolvido integralmente pelo mesmo meio de pagamento utilizado, incluindo o frete original.",
        ],
      },
      {
        heading: "3. Condições da peça",
        paragraphs: [
          "A peça precisa estar sem uso, sem lavagem, sem odores, com a etiqueta original afixada e na embalagem recebida.",
          "Peças com sinais de uso, alteração ou dano causado pelo cliente não são aceitas para troca ou devolução.",
        ],
      },
      {
        heading: "4. Produto com defeito",
        paragraphs: [
          "Identificou um defeito de fabricação? Avise em até 90 dias. Analisamos o caso e, confirmado o defeito, substituímos a peça ou devolvemos o valor pago, sem custo de frete.",
        ],
      },
      {
        heading: "5. Como solicitar",
        paragraphs: [
          `Chame no WhatsApp ${siteConfig.contact.whatsappLabel} com o código do pedido e fotos da peça. Nossa equipe responde com as instruções em até 1 dia útil.`,
        ],
      },
    ],
  },
  {
    slug: "entrega",
    title: "Política de entrega",
    summary: "Prazos de postagem, modalidades de envio, frete grátis e rastreamento.",
    updatedAt: "2026-01-15",
    sections: [
      {
        heading: "1. Prazo de postagem",
        paragraphs: [
          `${siteConfig.policies.dispatchTime} após a confirmação do pedido. Pedidos feitos em fins de semana e feriados são preparados no próximo dia útil.`,
        ],
      },
      {
        heading: "2. Modalidades de envio",
        paragraphs: [
          `${siteConfig.commerce.shipping.standard.label}: ${siteConfig.commerce.shipping.standard.eta}.`,
          `${siteConfig.commerce.shipping.express.label}: ${siteConfig.commerce.shipping.express.eta}.`,
          `${siteConfig.commerce.shipping.pickup.label}: ${siteConfig.commerce.shipping.pickup.eta}, sem custo, na recepção da academia.`,
        ],
      },
      {
        heading: "3. Frete grátis",
        paragraphs: [
          siteConfig.commerce.freeShippingThreshold > 0
            ? `Pedidos com subtotal a partir de R$ ${siteConfig.commerce.freeShippingThreshold},00 têm frete grátis na modalidade padrão, para todo o Brasil.`
            : "Promoções de frete grátis são divulgadas nos nossos canais oficiais.",
        ],
      },
      {
        heading: "4. Rastreamento",
        paragraphs: [
          "Todo pedido enviado recebe código de rastreio, informado por WhatsApp e disponível na área do cliente, em Meus pedidos.",
        ],
      },
      {
        heading: "5. Endereço incorreto ou ausência",
        paragraphs: [
          "Confira o endereço antes de finalizar. Em caso de devolução por endereço incorreto ou ausência do destinatário, o reenvio terá novo custo de frete.",
        ],
      },
    ],
  },
  {
    slug: "termos",
    title: "Termos de uso",
    summary: "As regras para navegar, comprar e utilizar os conteúdos desta loja.",
    updatedAt: "2026-01-15",
    sections: [
      {
        heading: "1. Aceitação",
        paragraphs: [
          `Ao navegar ou comprar em ${siteConfig.url}, você concorda com estes termos, com a política de privacidade e com as demais políticas publicadas.`,
        ],
      },
      {
        heading: "2. Cadastro e conta",
        paragraphs: [
          "As informações fornecidas devem ser verdadeiras e atualizadas. Você é responsável por manter a confidencialidade da sua senha e por todas as ações realizadas na sua conta.",
        ],
      },
      {
        heading: "3. Produtos, preços e disponibilidade",
        paragraphs: [
          "Fotos são meramente ilustrativas e podem apresentar leve variação de cor conforme a tela do dispositivo.",
          "Preços e estoques podem ser alterados sem aviso prévio. Erros evidentes de precificação podem levar ao cancelamento do pedido, com devolução integral de qualquer valor pago.",
        ],
      },
      {
        heading: "4. Propriedade intelectual",
        paragraphs: [
          `A marca ${siteConfig.name}, o logotipo, os textos, as fotografias e o layout deste site são protegidos por lei. É proibida a reprodução sem autorização por escrito.`,
        ],
      },
      {
        heading: "5. Contato e foro",
        paragraphs: [
          `Dúvidas sobre estes termos: ${siteConfig.contact.email}.`,
          `Fica eleito o foro da comarca de ${siteConfig.contact.address.city}/${siteConfig.contact.address.state} para dirimir eventuais controvérsias.`,
        ],
      },
    ],
  },
];

export function findPolicy(slug: string): PolicyDocument | undefined {
  return policies.find((policy) => policy.slug === slug);
}
