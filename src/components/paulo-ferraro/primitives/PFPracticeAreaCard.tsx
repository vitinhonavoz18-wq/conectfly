import { Car, FileSignature, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AreaAtuacao, IconeArea } from "../content";

/**
 * Desenho de cada área. Fica aqui, e não no arquivo de conteúdo, para que
 * mexer no texto do site nunca exija mexer em código.
 */
const ICONES: Record<IconeArea, LucideIcon> = {
  previdenciario: ShieldCheck,
  consumidor: ShoppingBag,
  civel: FileSignature,
  familia: Users,
  transito: Car,
};

interface PFPracticeAreaCardProps {
  area: AreaAtuacao;
}

/**
 * Cartão de área de atuação.
 *
 * Traço fino, canto praticamente reto e um fio bordô que atravessa o topo
 * quando o mouse passa — sofisticação vem do detalhe pequeno, não do enfeite
 * grande.
 */
export function PFPracticeAreaCard({ area }: PFPracticeAreaCardProps) {
  const Icone = ICONES[area.icone];

  return (
    <article className="pf-card pf-card--accent-top group h-full gap-5 overflow-hidden p-7 sm:p-8">
      <span
        aria-hidden="true"
        className="pf-icon-box flex h-11 w-11 items-center justify-center border border-[var(--pf-line)] text-[var(--pf-accent-text)]"
      >
        <Icone size={20} strokeWidth={1.3} />
      </span>

      <div className="flex flex-col gap-2.5">
        <h3 className="pf-h3">{area.titulo}</h3>
        <p className="pf-body" style={{ fontSize: "var(--pf-text-sm)" }}>
          {area.descricao}
        </p>
      </div>

      <ul className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-2">
        {area.topicos.map((topico) => (
          <li
            key={topico}
            className="border-l border-[var(--pf-line)] pl-3 text-[var(--pf-fg-subtle)] first:border-l-0 first:pl-0"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {topico}
          </li>
        ))}
      </ul>
    </article>
  );
}
