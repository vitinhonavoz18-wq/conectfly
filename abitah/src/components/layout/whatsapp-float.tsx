import { MessageCircle } from "lucide-react";
import { supportWhatsappLink } from "@/lib/whatsapp";

/** Atalho flutuante de atendimento. Número e URL vêm de siteConfig. */
export function WhatsappFloat() {
  return (
    <a
      href={supportWhatsappLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a equipe pelo WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-ink-800/90 text-neon-500 shadow-[0_12px_30px_rgba(0,0,0,0.55)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-neon-500/40 hover:text-neon-400 active:scale-95"
    >
      <MessageCircle className="h-5 w-5" aria-hidden />
    </a>
  );
}
