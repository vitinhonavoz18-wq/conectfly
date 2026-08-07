import Link from "next/link";
import { Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { footerNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { supportWhatsappLink } from "@/lib/whatsapp";

const paymentMethods = ["Pix", "Visa", "Mastercard", "Elo", "Amex", "Boleto"];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink-700 bg-ink-900">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo variant="full" width={190} height={130} className="h-24" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-smoke-300">
              A {siteConfig.name} nasceu dentro da academia e veste quem transforma disciplina em
              resultado. Roupas e acessórios oficiais, produzidos para aguentar o treino de verdade.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href={supportWhatsappLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3.5 py-2 text-xs font-semibold text-smoke-200 transition-colors hover:border-neon-500 hover:text-neon-400"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp
              </a>
              <a
                href={siteConfig.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3.5 py-2 text-xs font-semibold text-smoke-200 transition-colors hover:border-neon-500 hover:text-neon-400"
              >
                <Instagram className="h-4 w-4" aria-hidden />
                {siteConfig.social.instagramHandle}
              </a>
            </div>
          </div>

          {footerNav.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-neon-500">
                {column.title}
              </h3>
              <ul className="space-y-2.5">
                {column.items.map((item) => (
                  <li key={`${column.title}-${item.href}`}>
                    <Link
                      href={item.href}
                      className="text-sm text-smoke-300 transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 grid gap-6 border-t border-ink-700 pt-8 sm:grid-cols-3">
          <div className="flex items-start gap-3 text-sm text-smoke-300">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-500" aria-hidden />
            <span>
              {siteConfig.contact.address.street} — {siteConfig.contact.address.district}
              <br />
              {siteConfig.contact.address.city}/{siteConfig.contact.address.state} · CEP{" "}
              {siteConfig.contact.address.zip}
            </span>
          </div>
          <div className="flex items-start gap-3 text-sm text-smoke-300">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-neon-500" aria-hidden />
            <span>
              {siteConfig.contact.whatsappLabel}
              <br />
              {siteConfig.contact.hours[0].days}: {siteConfig.contact.hours[0].time}
            </span>
          </div>
          <div className="flex items-start gap-3 text-sm text-smoke-300">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-neon-500" aria-hidden />
            <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-white">
              {siteConfig.contact.email}
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-ink-700 pt-8">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-smoke-400">
            Formas de pagamento
          </h3>
          <ul className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <li
                key={method}
                className="rounded-md border border-ink-600 bg-ink-850 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-smoke-300"
              >
                {method}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-smoke-400">
            Pagamento online em implantação. No momento, o pedido é finalizado com atendimento pelo
            WhatsApp.
          </p>
        </div>
      </div>

      <div className="border-t border-ink-700 bg-ink-950">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-smoke-400">
            © {year} {siteConfig.legalName}. Todos os direitos reservados.
          </p>
          <p className="text-xs text-smoke-400">
            <Link href="/politicas/privacidade" className="hover:text-neon-400">
              Privacidade
            </Link>
            <span className="mx-2 text-ink-500">·</span>
            <Link href="/politicas/termos" className="hover:text-neon-400">
              Termos de uso
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
