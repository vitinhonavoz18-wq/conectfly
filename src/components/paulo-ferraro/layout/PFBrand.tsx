import { cn } from "@/lib/utils";
import { LOGO_ALTURA, LOGO_LARGURA, logoMarca } from "../assets";
import { perfil } from "../content";

interface PFBrandProps {
  /** Versão reduzida — usada no cabeçalho depois que a página rola. */
  compacta?: boolean;
  /**
   * Mostra "Advocacia e Consultoria Jurídica" embaixo da logo. Só faz sentido
   * onde sobra altura: no rodapé, não na barra de cima.
   */
  comDescritor?: boolean;
  className?: string;
}

/**
 * Assinatura do escritório: a logo oficial.
 *
 * O que aparece é o monograma PF, a barra e o nome "PAULO FERRARO" — a mesma
 * logo que o cliente enviou, sem redesenho, só sem a linha miúda de baixo, que
 * no tamanho do cabeçalho não se lê (a explicação inteira está em `assets.ts`).
 *
 * Essa linha não sumiu do site: no rodapé ela aparece como texto de verdade,
 * logo abaixo da logo.
 *
 * Se o arquivo da logo sumir da pasta, o componente volta a escrever o nome em
 * letra serifada com o fio de bronze ao lado, como era antes de a logo chegar.
 * É o pneu estepe: ninguém quer usar, mas o carro não fica parado.
 */
export function PFBrand({ compacta = false, comDescritor = false, className }: PFBrandProps) {
  const marca = logoMarca ? (
    <img
      src={logoMarca}
      alt={`${perfil.nome} — ${perfil.descritor}`}
      width={LOGO_LARGURA}
      height={LOGO_ALTURA}
      className="pf-brand__logo"
      data-pf-compacta={compacta}
      decoding="async"
    />
  ) : (
    <MarcaEscrita compacta={compacta} />
  );

  if (!comDescritor) {
    return <span className={cn("flex items-center", className)}>{marca}</span>;
  }

  return (
    <span className={cn("flex flex-col items-start gap-2.5", className)}>
      {marca}
      <span className="pf-brand__descritor">{perfil.descritor}</span>
    </span>
  );
}

/**
 * Plano B, usado só se o arquivo da logo não estiver na pasta: o nome em
 * serifada com um fio de bronze à esquerda e a palavra "Advogado" embaixo.
 */
function MarcaEscrita({ compacta }: { compacta: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="w-px shrink-0 bg-[var(--pf-accent)] transition-all duration-500"
        style={{ height: compacta ? "1.5rem" : "2rem" }}
      />
      <span className="flex flex-col leading-none">
        <span
          className="pf-serif pf-numeral text-[var(--pf-fg)]"
          style={{
            fontSize: compacta ? "1.125rem" : "1.35rem",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            transition: "font-size var(--pf-dur) var(--pf-ease-out)",
          }}
        >
          {perfil.nome}
        </span>
        <span
          className="text-[var(--pf-fg-muted)]"
          style={{
            /* Era 9px. Abaixo de 10px a palavra vira mancha em tela de
             * celular — e ainda reprovava no teste de contraste. */
            fontSize: "0.625rem",
            fontWeight: 600,
            letterSpacing: "var(--pf-tracking-eyebrow)",
            textTransform: "uppercase",
            marginTop: "0.25rem",
          }}
        >
          {perfil.titulo}
        </span>
      </span>
    </span>
  );
}
