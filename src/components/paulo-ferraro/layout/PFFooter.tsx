import { Instagram } from "lucide-react";
import { isPendente, navegacao, perfil, rodape } from "../content";
import { scrollToAnchor } from "../navigation";
import { PFPlaceholder } from "../primitives/PFPlaceholder";
import { PFBrand } from "./PFBrand";

/**
 * RODAPÉ institucional e minimalista.
 *
 * Reúne o que a advocacia precisa ter visível: identificação profissional,
 * número da OAB, links legais (Política de Privacidade e Termos) e o aviso de
 * que o site é informativo — não é oferta de serviço nem promessa de
 * resultado. Enquanto os dados não chegarem, cada campo mostra a etiqueta
 * dourada de pendência, em vez de sumir da página e ser esquecido.
 */
export function PFFooter() {
  return (
    <footer
      data-pf-surface="dark"
      className="border-t border-[var(--pf-line)] bg-[var(--pf-bg)]"
      aria-label="Rodapé"
    >
      <div className="pf-container flex flex-col gap-10 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Identidade */}
          <div className="flex flex-col gap-5 md:col-span-5">
            <PFBrand />
            <p className="pf-body max-w-[44ch]" style={{ fontSize: "var(--pf-text-sm)" }}>
              {rodape.descricao}
            </p>

            <div className="flex flex-col gap-2">
              <span
                className="text-[var(--pf-fg-subtle)]"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "var(--pf-tracking-eyebrow)",
                  textTransform: "uppercase",
                }}
              >
                Inscrição profissional
              </span>
              {isPendente(perfil.oab) ? (
                <PFPlaceholder campo="número da OAB" />
              ) : (
                <span className="pf-body" style={{ fontSize: "var(--pf-text-sm)" }}>
                  {perfil.oab}
                </span>
              )}
            </div>
          </div>

          {/* Navegação */}
          <nav className="flex flex-col gap-4 md:col-span-4" aria-label="Seções do site">
            <span
              className="text-[var(--pf-fg-subtle)]"
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "var(--pf-tracking-eyebrow)",
                textTransform: "uppercase",
              }}
            >
              Navegação
            </span>
            <ul className="flex flex-col gap-2.5">
              {navegacao.map((item) => (
                <li key={item.ancora}>
                  <a
                    href={`#${item.ancora}`}
                    className="pf-link text-[var(--pf-fg-muted)]"
                    style={{ fontSize: "var(--pf-text-sm)" }}
                    onClick={(evento) => {
                      evento.preventDefault();
                      scrollToAnchor(item.ancora);
                    }}
                  >
                    {item.rotulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Links legais e redes */}
          <div className="flex flex-col gap-4 md:col-span-3">
            <span
              className="text-[var(--pf-fg-subtle)]"
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "var(--pf-tracking-eyebrow)",
                textTransform: "uppercase",
              }}
            >
              Informações legais
            </span>
            <ul className="flex flex-col gap-2.5">
              {rodape.linksLegais.map((link) => (
                <li key={link.rotulo}>
                  {isPendente(link.href) ? (
                    <span className="flex flex-col gap-1.5">
                      <span
                        className="text-[var(--pf-fg-muted)]"
                        style={{ fontSize: "var(--pf-text-sm)" }}
                      >
                        {link.rotulo}
                      </span>
                      <PFPlaceholder campo={`link de ${link.rotulo.toLowerCase()}`} />
                    </span>
                  ) : (
                    <a
                      href={link.href}
                      className="pf-link text-[var(--pf-fg-muted)]"
                      style={{ fontSize: "var(--pf-text-sm)" }}
                    >
                      {link.rotulo}
                    </a>
                  )}
                </li>
              ))}
            </ul>

            <a
              href={perfil.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-fit items-center gap-2.5 border border-[var(--pf-line)] px-3 py-2 text-[var(--pf-fg-muted)] transition-colors hover:border-[var(--pf-line-strong)] hover:text-[var(--pf-fg)]"
              style={{ fontSize: "var(--pf-text-xs)" }}
            >
              <Instagram size={15} strokeWidth={1.4} aria-hidden="true" />
              {perfil.instagram}
            </a>
          </div>
        </div>

        <div className="pf-rule" />

        <div className="flex flex-col gap-6">
          <p
            className="max-w-[86ch] text-[var(--pf-fg-subtle)]"
            style={{ fontSize: "var(--pf-text-xs)", lineHeight: 1.7 }}
          >
            {rodape.avisoEtico}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[var(--pf-fg-subtle)]" style={{ fontSize: "var(--pf-text-xs)" }}>
              {rodape.copyright}
            </span>
            <span
              className="text-[var(--pf-fg-subtle)]"
              style={{ fontSize: "var(--pf-text-xs)", letterSpacing: "0.06em" }}
            >
              {perfil.titulo} · {perfil.especialidade}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
