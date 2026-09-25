import type { Metadata } from "next";
import { Compass, Eye, Flag, Target } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section, SectionHeading } from "@/components/ui/section";
import { MediaFrame } from "@/components/ui/media-frame";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Sobre a marca",
  description:
    "Conheça a história da ABITAH: a academia, a comunidade e a coleção própria criada para quem treina de verdade.",
  alternates: { canonical: "/sobre" },
};

/* Todos os textos abaixo são provisórios e podem ser substituídos.
   Nenhum trecho usa Lorem Ipsum — o conteúdo já está pronto para publicação. */

const values = [
  {
    icon: Flag,
    title: "Missão",
    text: "Equipar quem treina com peças honestas, resistentes e confortáveis, criadas a partir da experiência real de quem vive a academia todos os dias.",
  },
  {
    icon: Eye,
    title: "Visão",
    text: "Ser a marca de referência entre academias de treino livre no Brasil, reconhecida pela qualidade do produto e pela força da comunidade que veste.",
  },
  {
    icon: Target,
    title: "Valores",
    text: "Constância acima de motivação. Verdade acima de promessa. Respeito por quem começa hoje e por quem já carrega anos de disciplina.",
  },
  {
    icon: Compass,
    title: "Propósito",
    text: "Transformar o esforço individual em pertencimento coletivo — porque ninguém evolui sozinho por muito tempo.",
  },
];

const timeline = [
  {
    year: "2019",
    title: "O começo do espaço",
    text: "A academia abriu as portas com equipamentos básicos, poucos alunos e uma ideia simples: um espaço de treino livre, sem julgamento e sem fórmula pronta.",
  },
  {
    year: "2021",
    title: "A comunidade cresce",
    text: "O boca a boca trouxe atletas, iniciantes e famílias inteiras. As turmas se misturaram e nasceu o senso de time que sustenta o nosso dia a dia.",
  },
  {
    year: "2023",
    title: "As primeiras peças",
    text: "Um lote pequeno de camisetas feito para os alunos esgotou em uma semana. Foi o sinal de que a marca precisava existir de verdade.",
  },
  {
    year: "2025",
    title: "Coleção própria",
    text: "Com fornecedores nacionais e testes feitos dentro da academia, estruturamos a linha completa de roupas e acessórios que você encontra na loja.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Nossa história"
        title="Sobre a marca"
        description={`A ${siteConfig.name} não nasceu em uma mesa de escritório. Nasceu no chão da academia, entre séries pesadas e conversas de fim de treino.`}
        breadcrumbs={[{ label: "Sobre a marca" }]}
      />

      <Section tone="black">
        <div className="container-page grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <h2 className="section-rule text-2xl font-extrabold uppercase text-white sm:text-3xl">
              A academia
            </h2>
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-smoke-300">
              <p>
                Somos um espaço de treino livre: cada aluno constrói a própria rotina, com apoio
                técnico quando precisa e liberdade para evoluir no próprio ritmo. Não trabalhamos com
                promessas rápidas nem com métodos milagrosos.
              </p>
              <p>
                O que temos é estrutura, acompanhamento honesto e uma comunidade que puxa junto. É
                comum ver o aluno de primeira semana treinando ao lado de quem compete há anos — e é
                exatamente essa mistura que dá identidade ao lugar.
              </p>
              <p>
                Essa convivência criou uma linguagem própria, com apelidos, recordes anotados na
                parede e a sensação de pertencer a algo maior que o próprio treino.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120} className="grid grid-cols-2 gap-3">
            <MediaFrame
              src={null}
              alt="Área de musculação da academia"
              label="Foto da academia"
              className="aspect-3/4 w-full"
              sizes="(max-width: 1024px) 45vw, 24vw"
            />
            <MediaFrame
              src={null}
              alt="Alunos treinando"
              label="Foto dos alunos"
              className="mt-8 aspect-3/4 w-full"
              sizes="(max-width: 1024px) 45vw, 24vw"
            />
          </Reveal>
        </div>
      </Section>

      <Section tone="graphite">
        <div className="container-page">
          <SectionHeading
            eyebrow="Linha do tempo"
            title="Como chegamos até aqui"
            description="Uma trajetória construída em etapas, com os alunos participando de cada decisão."
          />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {timeline.map((item, index) => (
              <Reveal as="li" key={item.year} delay={index * 80}>
                <div className="h-full rounded-card border border-ink-700 bg-ink-850 p-5">
                  <p className="text-2xl font-black text-neon-500">{item.year}</p>
                  <h3 className="mt-2 text-sm font-bold uppercase tracking-wide text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-xs leading-relaxed text-smoke-300">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="black">
        <div className="container-page">
          <SectionHeading
            eyebrow="No que acreditamos"
            title="Missão, visão e valores"
            description="Os princípios que orientam cada decisão de produto e de atendimento."
          />
          <ul className="grid gap-4 sm:grid-cols-2">
            {values.map((value, index) => (
              <Reveal as="li" key={value.title} delay={index * 80}>
                <div className="flex h-full gap-4 rounded-card border border-ink-700 bg-ink-900 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neon-500/25 bg-neon-500/8 text-neon-500">
                    <value.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                      {value.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-smoke-300">{value.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="graphite">
        <div className="container-page grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal className="order-2 grid grid-cols-2 gap-3 lg:order-1">
            <MediaFrame
              src={null}
              alt="Atleta com a coleção oficial"
              label="Foto do atleta"
              className="aspect-3/4 w-full"
              sizes="(max-width: 1024px) 45vw, 24vw"
            />
            <MediaFrame
              src={null}
              alt="Peças da coleção"
              label="Foto da coleção"
              className="mt-8 aspect-3/4 w-full"
              sizes="(max-width: 1024px) 45vw, 24vw"
            />
          </Reveal>

          <Reveal delay={100} className="order-1 lg:order-2">
            <h2 className="section-rule text-2xl font-extrabold uppercase text-white sm:text-3xl">
              A coleção própria
            </h2>
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-smoke-300">
              <p>
                Cada peça começa com um problema real relatado por quem treina: a camiseta que
                encurta, o short que incomoda no agachamento, a legging que fica transparente. A
                partir daí testamos tecidos, modelagens e acabamentos até chegar em algo que aguenta
                a rotina.
              </p>
              <p>
                Trabalhamos com fornecedores nacionais, em lotes controlados, priorizando gramatura
                adequada, costura reforçada e cores que não desbotam. Antes de entrar na loja, toda
                peça passa semanas sendo usada em treino real por alunos e professores.
              </p>
              <p>
                É por isso que a nossa coleção não segue a velocidade da moda: ela segue a velocidade
                do que realmente funciona.
              </p>
            </div>
            <ButtonLink href="/loja" size="lg" className="mt-8">
              Conhecer a coleção
            </ButtonLink>
          </Reveal>
        </div>
      </Section>

      <Section tone="black">
        <div className="container-page rounded-card border border-neon-500/25 bg-gradient-to-br from-ink-900 to-ink-950 px-6 py-12 text-center sm:px-12">
          <h2 className="text-2xl font-black uppercase leading-tight text-white sm:text-3xl">
            {siteConfig.institutional.communityHeadline}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-smoke-300">
            {siteConfig.institutional.communityText}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/loja" size="lg">
              Ver produtos
            </ButtonLink>
            <ButtonLink href="/contato" variant="outline" size="lg">
              Falar com a equipe
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
