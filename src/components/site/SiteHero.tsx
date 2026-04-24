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
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16">
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
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--site-bg)/0.7)] via-[hsl(var(--site-bg)/0.85)] to-[hsl(var(--site-bg))]" />
      <div className="relative z-10 text-center px-4 py-20">
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
            className="px-6 py-3 rounded-full bg-[hsl(var(--site-secondary))] text-black font-bold hover:opacity-90 transition"
          >
            Ver combos
          </a>
          <a
            href="#cardapio"
            className="px-6 py-3 rounded-full border border-[hsl(var(--site-border))] font-bold hover:bg-[hsl(var(--site-card))] transition"
          >
            Cardápio
          </a>
        </div>
      </div>
    </section>
  );
}