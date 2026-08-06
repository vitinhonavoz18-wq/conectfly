import type { Metadata } from "next";
import { Clock, Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section, SectionHeading } from "@/components/ui/section";
import { Accordion } from "@/components/ui/accordion";
import { ContactForm } from "@/components/contact/contact-form";
import { siteConfig } from "@/config/site";
import { supportWhatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Fale com a equipe ABITAH: WhatsApp, e-mail, Instagram, endereço da academia, horário de funcionamento e perguntas frequentes.",
  alternates: { canonical: "/contato" },
};

const faq = [
  {
    question: "Como escolho o tamanho certo?",
    answer:
      "Cada produto tem a tabela de medidas na própria página, com tórax, cintura e comprimento por tamanho. Se ficar entre dois tamanhos, fale com a gente no WhatsApp informando altura e peso — indicamos a modelagem mais adequada.",
  },
  {
    question: "Qual o prazo de entrega?",
    answer:
      "A postagem acontece em até 2 dias úteis após a confirmação do pedido. A entrega padrão leva de 5 a 9 dias úteis e a expressa de 2 a 4 dias úteis, conforme a região. Também é possível retirar na academia sem custo.",
  },
  {
    question: "Posso trocar se não servir?",
    answer:
      "Sim. A primeira troca por tamanho é gratuita, dentro de 7 dias após o recebimento, com a peça sem uso e com etiqueta. Basta chamar no WhatsApp com o código do pedido que organizamos a logística.",
  },
  {
    question: "Quais formas de pagamento vocês aceitam?",
    answer:
      "Neste momento o pedido é fechado pelo WhatsApp, onde combinamos Pix, cartão ou link de pagamento seguro. O checkout com pagamento online integrado está em implantação e será ativado em breve.",
  },
  {
    question: "Vocês entregam em todo o Brasil?",
    answer:
      "Sim, enviamos para todas as regiões com código de rastreio. Pedidos acima do valor de frete grátis configurado saem sem custo de envio.",
  },
  {
    question: "Preciso ser aluno da academia para comprar?",
    answer:
      "Não. A loja é aberta a todos. Os alunos têm condições especiais divulgadas na recepção e nos nossos canais oficiais.",
  },
];

export default function ContactPage() {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(
    siteConfig.contact.address.mapQuery,
  )}&output=embed`;

  return (
    <>
      <PageHeader
        eyebrow="Estamos por perto"
        title="Contato"
        description="Dúvida sobre tamanho, pedido ou troca? Fale direto com a nossa equipe — atendimento humano, sem robô."
        breadcrumbs={[{ label: "Contato" }]}
      />

      <Section tone="black">
        <div className="container-page grid gap-8 lg:grid-cols-[1fr_360px]">
          <ContactForm />

          <div className="space-y-4">
            <a
              href={supportWhatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3.5 rounded-card border border-ink-700 bg-ink-900 p-5 transition-colors hover:border-neon-500/50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#1FA02F]/15 text-[#4DF25F]">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">WhatsApp</h3>
                <p className="mt-1 text-sm text-smoke-300">{siteConfig.contact.whatsappLabel}</p>
                <p className="mt-0.5 text-xs text-neon-400">Resposta em minutos no horário comercial</p>
              </div>
            </a>

            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="flex items-start gap-3.5 rounded-card border border-ink-700 bg-ink-900 p-5 transition-colors hover:border-neon-500/50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neon-500/10 text-neon-500">
                <Mail className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">E-mail</h3>
                <p className="mt-1 break-all text-sm text-smoke-300">{siteConfig.contact.email}</p>
              </div>
            </a>

            <a
              href={siteConfig.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3.5 rounded-card border border-ink-700 bg-ink-900 p-5 transition-colors hover:border-neon-500/50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neon-500/10 text-neon-500">
                <Instagram className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Instagram</h3>
                <p className="mt-1 text-sm text-smoke-300">{siteConfig.social.instagramHandle}</p>
              </div>
            </a>

            <div className="flex items-start gap-3.5 rounded-card border border-ink-700 bg-ink-900 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neon-500/10 text-neon-500">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Endereço</h3>
                <p className="mt-1 text-sm leading-relaxed text-smoke-300">
                  {siteConfig.contact.address.street}
                  <br />
                  {siteConfig.contact.address.district} — {siteConfig.contact.address.city}/
                  {siteConfig.contact.address.state}
                  <br />
                  CEP {siteConfig.contact.address.zip}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-card border border-ink-700 bg-ink-900 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neon-500/10 text-neon-500">
                <Clock className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
                  Horário de funcionamento
                </h3>
                <ul className="mt-1.5 space-y-1 text-sm text-smoke-300">
                  {siteConfig.contact.hours.map((hour) => (
                    <li key={hour.days} className="flex justify-between gap-4">
                      <span>{hour.days}</span>
                      <span className="text-smoke-200">{hour.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="graphite">
        <div className="container-page">
          <SectionHeading
            eyebrow="Onde estamos"
            title="Venha treinar com a gente"
            description="Troque o endereço oficial no arquivo de configurações para atualizar o mapa automaticamente."
          />
          <div className="overflow-hidden rounded-card border border-ink-700">
            <iframe
              title={`Mapa — ${siteConfig.contact.address.mapQuery}`}
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-90 w-full border-0 grayscale-[35%]"
            />
          </div>
        </div>
      </Section>

      <Section tone="black" id="faq">
        <div className="container-page">
          <SectionHeading
            eyebrow="Tire suas dúvidas"
            title="Perguntas frequentes"
            description="As respostas para o que mais nos perguntam no WhatsApp."
          />
          <Accordion items={faq} className="mx-auto max-w-3xl" />
        </div>
      </Section>
    </>
  );
}
