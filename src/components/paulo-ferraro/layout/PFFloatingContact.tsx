import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { contato, ctaPrincipal, isPendente } from "../content";
import { scrollToAnchor } from "../navigation";

/**
 * Botão flutuante de contato.
 *
 * Só aparece depois que a pessoa passa da primeira tela — antes disso os dois
 * botões do Hero já resolvem, e um botão flutuante ali em cima seria como o
 * garçom perguntando o pedido enquanto o cliente ainda lê o cardápio.
 *
 * Não pisca, não pula, não abre janela nenhuma por conta própria. Entra
 * deslizando de baixo em 0,3 segundo e fica quieto no canto.
 *
 * Enquanto o número do WhatsApp não for informado, ele leva para a seção de
 * contato em vez de abrir uma conversa vazia. Assim que o número entrar em
 * `content.ts`, o mesmo botão passa a abrir o WhatsApp direto — sem mexer em
 * mais nada.
 */
export function PFFloatingContact() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    const hero = document.getElementById("inicio");
    if (!hero) return;

    // O botão acende quando o Hero sai de cena. Quem avisa é o navegador —
    // não existe medição de rolagem rodando o tempo todo.
    const observador = new IntersectionObserver(
      ([entrada]) => setVisivel(!entrada.isIntersecting),
      { rootMargin: "-70% 0px 0px 0px", threshold: 0 },
    );

    observador.observe(hero);
    return () => observador.disconnect();
  }, []);

  const whatsapp = contato.canais.find((canal) => canal.chave === "whatsapp");
  const temWhatsapp = whatsapp !== undefined && !isPendente(whatsapp.href);

  const conteudo = (
    <>
      <MessageCircle size={17} strokeWidth={1.6} aria-hidden="true" />
      <span className="pf-fab__label">{ctaPrincipal.rotulo}</span>
    </>
  );

  if (temWhatsapp) {
    return (
      <a
        href={whatsapp.href}
        target="_blank"
        rel="noopener noreferrer"
        className="pf-fab"
        data-pf-shown={visivel}
        aria-hidden={!visivel}
        tabIndex={visivel ? undefined : -1}
        aria-label={`${ctaPrincipal.rotulo} pelo WhatsApp`}
      >
        {conteudo}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="pf-fab"
      data-pf-shown={visivel}
      aria-hidden={!visivel}
      tabIndex={visivel ? undefined : -1}
      aria-label={ctaPrincipal.rotulo}
      onClick={() => scrollToAnchor(ctaPrincipal.ancora)}
    >
      {conteudo}
    </button>
  );
}
