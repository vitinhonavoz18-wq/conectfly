import { MessageCircle } from "lucide-react";
import { supportWhatsappLink } from "@/lib/whatsapp";

export function WhatsappFloat() {
  return (
    <a
      href={supportWhatsappLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a equipe pelo WhatsApp"
      className="fixed bottom-5 left-5 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-[#1FA02F] text-white shadow-[0_12px_30px_-10px_rgba(31,160,47,0.8)] transition-transform hover:scale-105 active:scale-95"
    >
      <MessageCircle className="h-6 w-6" aria-hidden />
    </a>
  );
}
