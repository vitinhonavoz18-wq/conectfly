import { useParallax } from "./Reveal";

interface Props {
  name: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroMediaType?: string;
  heroVideoUrl?: string | null;
}

export function SiteHero({
  name,
  tagline,
  description,
  logoUrl,
  heroImageUrl,
  heroMediaType = "image",
  heroVideoUrl,
}: Props) {
  const showVideo = heroMediaType === "video" && heroVideoUrl;
  const { ref: bgRef, offset } = useParallax(0.18);
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16">
      <div
        ref={bgRef as any}
        className="absolute inset-0 will-change-transform"
        style={{ transform: `translate3d(0, ${offset}px, 0) scale(1.08)` }}
      >
        {showVideo ? (
          <video
            src={heroVideoUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : heroImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageUrl})` }}
          />
        ) : null}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--site-bg)/0.7)] via-[hsl(var(--site-bg)/0.85)] to-[hsl(var(--site-bg))]" />
      <div className="relative z-10 text-center px-4 py-20 site-hero-enter">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            className="mx-auto mb-6 h-48 sm:h-64 md:h-80 w-auto object-contain drop-shadow-2xl"
          />
        ) : (
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6">
            {name}
          </h1>
        )}
        {tagline && (
          <p className="text-xl sm:text-2xl font-semibold text-[hsl(var(--site-secondary))] mb-3">
            {tagline}
          </p>
        )}
        {description && (
          <p className="max-w-xl mx-auto text-[hsl(var(--site-muted-fg))]">
            {description}
          </p>
        )}
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <a
            href="#combos"
            className="px-6 py-3 rounded-full bg-[hsl(var(--site-secondary))] text-black font-bold transition transform hover:-translate-y-0.5 hover:shadow-lg hover:opacity-95"
          >
            Ver combos
          </a>
          <a
            href="#cardapio"
            className="px-6 py-3 rounded-full border border-[hsl(var(--site-border))] font-bold transition transform hover:-translate-y-0.5 hover:bg-[hsl(var(--site-card))]"
          >
            Cardápio
          </a>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-1 text-[hsl(var(--site-muted-fg))] animate-bounce">
          <span className="text-[10px] uppercase tracking-[0.2em]">Role</span>
          <span className="block w-px h-6 bg-[hsl(var(--site-muted-fg))]" />
        </div>
      </div>
    </section>
  );
}