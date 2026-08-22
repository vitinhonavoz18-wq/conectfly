import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { ctaPrincipal, navegacao } from "../content";
import { scrollToAnchor } from "../navigation";
import { useActiveSection } from "../hooks/useActiveSection";
import { useScrolled } from "../hooks/useScrolled";
import { PFButton } from "../primitives/PFButton";
import { PFBrand } from "./PFBrand";

// Lista fixa, criada uma vez só. Se fosse montada a cada desenho da tela, o
// vigia das seções seria desmontado e remontado sem parar.
const ANCORAS = navegacao.map((item) => item.ancora);

/**
 * Cabeçalho fixo.
 *
 * No topo da página ele é transparente e faz parte da fotografia. Assim que a
 * pessoa rola, encolhe e ganha fundo de vidro fosco — o mesmo efeito de uma
 * placa de vidro sobre a mesa: dá para ver o que está embaixo, mas o que está
 * escrito em cima continua legível.
 *
 * O item do menu correspondente à seção que está sendo lida fica aceso, com um
 * fio dourado embaixo. É a placa da rua mudando conforme o quarteirão.
 *
 * No celular o menu é próprio, não o de computador espremido: abre em tela
 * cheia com fundo desfocado, os itens entram em sequência, cada um numerado e
 * grande o suficiente para o dedo. Enquanto ele está aberto:
 *
 * - a página atrás não rola (senão a pessoa perde o lugar ao fechar);
 * - a tecla Esc fecha;
 * - o Tab circula apenas dentro do menu, sem escapar para o que está atrás;
 * - ao fechar, o foco volta para o botão que abriu.
 */
export function PFHeader() {
  const rolou = useScrolled();
  const secaoAtiva = useActiveSection(ANCORAS);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const botaoAbrirRef = useRef<HTMLButtonElement>(null);

  const fecharMenu = useCallback(() => setMenuAberto(false), []);

  // Trava a rolagem da página enquanto o menu estiver aberto.
  useEffect(() => {
    if (typeof document === "undefined" || !menuAberto) return;

    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = anterior;
    };
  }, [menuAberto]);

  // Esc fecha, Tab circula dentro do menu, e o foco volta ao botão de abrir.
  useEffect(() => {
    if (!menuAberto || typeof window === "undefined") return;

    const menu = menuRef.current;
    // Guardado agora, para a limpeza devolver o foco ao mesmo botão que abriu
    // o menu — e não a outro elemento que tenha assumido a referência depois.
    const botaoQueAbriu = botaoAbrirRef.current;
    menu?.querySelector<HTMLElement>("button, a")?.focus();

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        fecharMenu();
        return;
      }

      if (evento.key !== "Tab" || !menu) return;

      const focaveis = menu.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (focaveis.length === 0) return;

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };

    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      botaoQueAbriu?.focus();
    };
  }, [menuAberto, fecharMenu]);

  const irPara = (ancora: string) => {
    setMenuAberto(false);
    // Espera o menu fechar antes de rolar: com ele aberto a página está
    // travada e a rolagem não sairia do lugar.
    window.requestAnimationFrame(() => scrollToAnchor(ancora));
  };

  return (
    <>
      <header className="pf-header" data-pf-scrolled={rolou}>
        <div className="pf-container flex items-center justify-between gap-4 xl:gap-6">
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
            className="hidden items-center lg:flex lg:gap-5 xl:gap-7"
          >
            {navegacao.map((item) => (
              <a
                key={item.ancora}
                href={`#${item.ancora}`}
                className="pf-nav-link"
                data-pf-active={secaoAtiva === item.ancora}
                aria-current={secaoAtiva === item.ancora ? "true" : undefined}
                onClick={(evento) => {
                  evento.preventDefault();
                  irPara(item.ancora);
                }}
              >
                {item.curto ?? item.rotulo}
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
              {/* Entre 768 e 1280 px o cabeçalho fica apertado: o botão usa o
                  rótulo curto para não ser empurrado para fora da tela. */}
              <span className="xl:hidden">{ctaPrincipal.rotuloCurto}</span>
              <span className="hidden xl:inline">{ctaPrincipal.rotulo}</span>
              <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" data-pf-arrow="" />
            </PFButton>

            <button
              ref={botaoAbrirRef}
              type="button"
              onClick={() => setMenuAberto(true)}
              className="flex h-11 w-11 items-center justify-center border border-[var(--pf-line)] text-[var(--pf-fg)] transition-colors duration-200 hover:border-[var(--pf-line-gold)] hover:bg-[var(--pf-accent-veil)] lg:hidden"
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
        <div
          ref={menuRef}
          id="pf-menu-mobile"
          className="pf-menu lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div className="pf-container flex h-[var(--pf-header-h)] items-center justify-between">
            <PFBrand />
            <button
              type="button"
              onClick={fecharMenu}
              className="flex h-11 w-11 items-center justify-center border border-[var(--pf-line)] text-[var(--pf-fg)] transition-colors duration-200 hover:border-[var(--pf-line-gold)]"
              aria-label="Fechar menu"
            >
              <X size={20} strokeWidth={1.4} aria-hidden="true" />
            </button>
          </div>

          <nav
            aria-label="Navegação principal"
            className="pf-container flex flex-1 flex-col justify-center gap-1 overflow-y-auto pb-16"
          >
            {navegacao.map((item, indice) => (
              <a
                key={item.ancora}
                href={`#${item.ancora}`}
                onClick={(evento) => {
                  evento.preventDefault();
                  irPara(item.ancora);
                }}
                data-pf-active={secaoAtiva === item.ancora}
                aria-current={secaoAtiva === item.ancora ? "true" : undefined}
                className="pf-menu__item group flex items-baseline gap-4 border-b border-[var(--pf-line)] py-5"
                style={{ ["--pf-reveal-index" as string]: indice }}
              >
                <span className="pf-numeral text-[0.75rem] text-[var(--pf-accent-text)]">
                  {String(indice + 1).padStart(2, "0")}
                </span>
                <span
                  className="pf-menu__label text-[var(--pf-fg)]"
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
              className="pf-menu__item mt-8 w-full"
              style={{ ["--pf-reveal-index" as string]: navegacao.length }}
              onClick={fecharMenu}
            >
              {ctaPrincipal.rotulo}
              <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" data-pf-arrow="" />
            </PFButton>
          </nav>
        </div>
      ) : null}
    </>
  );
}
