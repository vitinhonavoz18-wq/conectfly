import { ArrowUpRight, Clock, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CanalContato } from "../content";
import { contato, isPendente } from "../content";
import { PFPlaceholder } from "../primitives/PFPlaceholder";
import { PFReveal } from "../primitives/PFReveal";
import { PFSection } from "../primitives/PFSection";
import { PFSectionHeading } from "../primitives/PFSectionHeading";

const ICONES: Record<CanalContato["chave"], LucideIcon> = {
  whatsapp: MessageCircle,
  telefone: Phone,
  email: Mail,
  localizacao: MapPin,
  instagram: Instagram,
};

/** Nome amigável do dado que falta, usado na etiqueta "a preencher". */
const NOME_PENDENTE: Record<CanalContato["chave"], string> = {
  whatsapp: "número do WhatsApp",
  telefone: "telefone",
  email: "e-mail",
  localizacao: "endereço",
  instagram: "perfil",
};

/**
 * Um canal de contato.
 *
 * Enquanto o dado não chegar, o cartão continua no lugar, no tamanho certo,
 * mas não vira link: não adianta um botão de WhatsApp que leva a lugar nenhum,
 * é como colocar a placa "entrada" apontando para a parede.
 */
function CanalCard({ canal }: { canal: CanalContato }) {
  const Icone = ICONES[canal.chave];
  const pendente = isPendente(canal.valor) || isPendente(canal.href);

  const conteudo = (
    <>
      <span
        aria-hidden="true"
        className="pf-icon-box flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--pf-line)] text-[var(--pf-accent-text)]"
      >
        <Icone size={19} strokeWidth={1.3} />
      </span>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span
          className="text-[var(--pf-fg-subtle)]"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "var(--pf-tracking-eyebrow)",
            textTransform: "uppercase",
          }}
        >
          {canal.rotulo}
        </span>

        {pendente ? (
          <PFPlaceholder campo={NOME_PENDENTE[canal.chave]} />
        ) : (
          <span
            className="pf-serif truncate text-[var(--pf-fg)]"
            style={{
              fontSize: "1.35rem",
              lineHeight: 1.25,
            }}
          >
            {canal.valor}
          </span>
        )}

        <span className="pf-body" style={{ fontSize: "var(--pf-text-xs)" }}>
          {canal.descricao}
        </span>
      </div>

      {!pendente ? (
        <ArrowUpRight
          size={16}
          strokeWidth={1.6}
          aria-hidden="true"
          className="pf-icon-shift ml-auto shrink-0 text-[var(--pf-fg-subtle)]"
        />
      ) : null}
    </>
  );

  const classes = "pf-card pf-card--accent-top group h-full flex-row gap-5 overflow-hidden p-6";

  if (pendente) {
    return <div className={classes}>{conteudo}</div>;
  }

  const externo = canal.href.startsWith("http");

  return (
    <a
      href={canal.href}
      className={classes}
      target={externo ? "_blank" : undefined}
      rel={externo ? "noopener noreferrer" : undefined}
    >
      {conteudo}
    </a>
  );
}

/**
 * CONTATO — todos os caminhos para falar com o advogado.
 */
export function PFContact() {
  return (
    <PFSection id="contato" superficie="graphite" aria-labelledby="pf-contato-titulo">
      <div className="pf-container grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="flex flex-col gap-8 lg:col-span-5">
          <PFSectionHeading
            id="pf-contato-titulo"
            eyebrow={contato.eyebrow}
            titulo={contato.titulo}
            chamada={contato.chamada}
          />

          <PFReveal animacao="fade-up" indice={3}>
            <p
              className="pf-serif max-w-[44ch] text-[var(--pf-fg)]"
              style={{
                fontSize: "1.35rem",
                lineHeight: 1.35,
              }}
            >
              {contato.resumo}
            </p>
          </PFReveal>

          <PFReveal animacao="fade" indice={4}>
            <div className="flex flex-col gap-3 border-t border-[var(--pf-line)] pt-6">
              <span className="flex items-center gap-2.5 text-[var(--pf-fg-subtle)]">
                <Clock size={15} strokeWidth={1.4} aria-hidden="true" />
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "var(--pf-tracking-eyebrow)",
                    textTransform: "uppercase",
                  }}
                >
                  Horário de atendimento
                </span>
              </span>

              {isPendente(contato.horario) ? (
                <PFPlaceholder campo="horário de atendimento" />
              ) : (
                <span className="pf-body">{contato.horario}</span>
              )}

              <p
                className="mt-2 max-w-[46ch] border-l border-[var(--pf-line-accent)] pl-4 text-[var(--pf-fg-subtle)]"
                style={{ fontSize: "var(--pf-text-xs)", lineHeight: 1.7 }}
              >
                {contato.nota}
              </p>
            </div>
          </PFReveal>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:col-span-7 xl:grid-cols-2">
          {contato.canais.map((canal, indice) => (
            <PFReveal key={canal.chave} animacao="fade-up" indice={indice} className="h-full">
              <CanalCard canal={canal} />
            </PFReveal>
          ))}
        </div>
      </div>
    </PFSection>
  );
}
