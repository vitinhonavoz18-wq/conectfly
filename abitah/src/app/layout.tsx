import type { Metadata, Viewport } from "next";
import { Anton, Barlow_Condensed, Inter, Permanent_Marker } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/layout/cart-drawer";
import { WhatsappFloat } from "@/components/layout/whatsapp-float";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/config/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/* Condensada — títulos e interface editorial */
const condensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-condensed",
  display: "swap",
});

/* Pôster — apenas a tipografia gigante do hero */
const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-anton",
  display: "swap",
});

/* Manuscrita — reservada aos elementos de campanha do hero */
const brush = Permanent_Marker({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-script-brush",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "roupas de academia",
    "moda fitness",
    "camiseta de treino",
    "legging de academia",
    "acessórios esportivos",
    siteConfig.name,
  ],
  authors: [{ name: siteConfig.legalName }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  themeColor: "#020403",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${condensed.variable} ${anton.variable} ${brush.variable}`}
    >
      <body className="flex min-h-dvh flex-col antialiased">
        <Providers>
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-lg focus:bg-neon-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink-950"
          >
            Pular para o conteúdo
          </a>
          <DemoModeBanner />
          <Header />
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <Footer />
          <CartDrawer />
          <WhatsappFloat />
        </Providers>
      </body>
    </html>
  );
}
