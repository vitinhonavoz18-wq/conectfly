import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ctaPrincipal, navegacao } from "../content";
import { scrollToAnchor } from "../navigation";
import { useScrolled } from "../hooks/useScrolled";
import { PFButton } from "../primitives/PFButton";
import { PFBrand } from "./PFBrand";

/**
 * Cabeçalho fixo.
 *
 * No topo da página ele é transparente e faz parte da fotografia. Assim que a
 * pessoa rola, encolhe e ganha fundo de vidro fosco — o mesmo efeito de uma
 * placa de vidro sobre a mesa: dá para ver o que está embaixo, mas o que está
 * escrito em cima continua legível.
 *
 * No celular o menu abre em tela cheia, com os itens grandes o suficiente para
 * o dedo, e a rolagem da página é travada enquanto ele estiver aberto — para a
 * pessoa não "perder o lugar" ao fechar.
 */
export function PFHeader() {
  const rolou = useScrolled();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const anterior = document.body.style.overflow;
    document.body.style.overflow = menuAberto ? "hidden" : anterior;

    return () => {
      document.body.style.overflow = anterior;
    };
  }, [menuAberto]);

  useEffect(() => {
    if (!menuAberto || typeof window === "undefined") return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setMenuAberto(false);
    };

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [menuAberto]);

  const irPara = (ancora: string) => {
    setMenuAberto(false);
    // Espera o menu fechar antes de rolar, senão a rolagem acontece com a
    // página ainda travada e não sai do lugar.
    window.requestAnimationFrame(() => scrollToAnchor(ancora));
  };

  return (
    <>
      <header className="pf-header" data-pf-scrolled={rolou}>
        <div className="pf-container flex items-center justify-between gap-6">
          <a
            href="#inicio"
            onClick={(evento) => {
              evento.preventDefault();
              irPara("inicio");
            }}
            aria-label="Paulo Ferraro — início"
          >
            <PFBrand compacta={rolou} />
          </a>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center lg:flex lg:gap-6 xl:gap-8"
          >
            {navegacao.map((item) => (
              <a
                key={item.ancora}
                href={`#${item.ancora}`}
                className="pf-nav-link"
                onClick={(evento) => {
                  evento.preventDefault();
                  irPara(item.ancora);
                }}
              >
                {item.rotulo}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <PFButton
              variante="primary"
              tamanho="sm"
              ancora={ctaPrincipal.ancora}
              className="hidden md:inline-flex"
            >
              {ctaPrincipal.rotulo}
            </PFButton>

            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              className="flex h-11 w-11 items-center justify-center border border-[var(--pf-line)] text-[var(--pf-fg)] transition-colors hover:border-[var(--pf-line-strong)] lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              aria-controls="pf-menu-mobile"
            >
              <Menu size={20} strokeWidth={1.4} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {menuAberto ? (
        <div id="pf-menu-mobile" className="pf-menu lg:hidden" role="dialog" aria-modal="true">
          <div className="pf-container flex h-[var(--pf-header-h)] items-center justify-between">
            <PFBrand />
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              className="flex h-11 w-11 items-center justify-center border border-[var(--pf-line)] text-[var(--pf-fg)]"
              aria-label="Fechar menu"
            >
              <X size={20} strokeWidth={1.4} aria-hidden="true" />
            </button>
          </div>

          <nav
            aria-label="Navegação principal"
            className="pf-container flex flex-1 flex-col justify-center gap-1 pb-16"
          >
            {navegacao.map((item, indice) => (
              <a
                key={item.ancora}
                href={`#${item.ancora}`}
                onClick={(evento) => {
                  evento.preventDefault();
                  irPara(item.ancora);
                }}
                className="group flex items-baseline gap-4 border-b border-[var(--pf-line)] py-5"
              >
                <span className="pf-numeral text-[0.75rem] text-[var(--pf-accent-text)]">
                  {String(indice + 1).padStart(2, "0")}
                </span>
                <span
                  className="text-[var(--pf-fg)] transition-colors group-hover:text-[var(--pf-accent-text)]"
                  style={{
                    fontFamily: "var(--pf-font-display)",
                    fontSize: "clamp(1.75rem, 8vw, 2.5rem)",
                    lineHeight: 1.1,
                  }}
                >
                  {item.rotulo}
                </span>
              </a>
            ))}

            <PFButton
              variante="primary"
              ancora={ctaPrincipal.ancora}
              className="mt-8 w-full"
              onClick={() => setMenuAberto(false)}
            >
              {ctaPrincipal.rotulo}
            </PFButton>
          </nav>
        </div>
      ) : null}
    </>
  );
}
