import { BadgeCheck, Headphones, ShieldCheck, Truck } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const benefits = [
  {
    icon: BadgeCheck,
    title: "Produtos oficiais",
    description: "Peças desenvolvidas e testadas dentro da academia.",
  },
  {
    icon: ShieldCheck,
    title: "Compra segura",
    description: "Seus dados protegidos do início ao fim do pedido.",
  },
  {
    icon: Truck,
    title: "Envio para todo o Brasil",
    description: "Postagem rápida e código de rastreio em todos os pedidos.",
  },
  {
    icon: Headphones,
    title: "Atendimento rápido",
    description: "Time real no WhatsApp para ajudar na escolha do tamanho.",
  },
];

/** Faixa de confiança logo abaixo do hero. */
export function Benefits() {
  return (
    <section className="border-y border-white/7 bg-ink-900">
      <ul className="container-page grid divide-y divide-white/6 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
        {benefits.map((benefit, index) => (
          <Reveal
            as="li"
            key={benefit.title}
            delay={index * 70}
            className="flex items-start gap-4 py-7 sm:px-6 lg:border-l lg:border-white/6 lg:first:border-l-0"
          >
            <benefit.icon className="mt-0.5 h-5 w-5 shrink-0 text-neon-500" aria-hidden />
            <div>
              <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.12em] text-smoke-100">
                {benefit.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-smoke-400">{benefit.description}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
