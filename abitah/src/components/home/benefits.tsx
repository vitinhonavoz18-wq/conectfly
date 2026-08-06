import { BadgeCheck, Headset, ShieldCheck, Truck } from "lucide-react";
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
    icon: Headset,
    title: "Atendimento rápido",
    description: "Time real no WhatsApp para ajudar na escolha do tamanho.",
  },
];

export function Benefits() {
  return (
    <section className="border-y border-ink-700 bg-ink-900">
      <ul className="container-page grid gap-px py-2 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((benefit, index) => (
          <Reveal
            as="li"
            key={benefit.title}
            delay={index * 70}
            className="flex items-start gap-3.5 px-1 py-5 sm:px-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neon-500/25 bg-neon-500/8 text-neon-500">
              <benefit.icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white">
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
