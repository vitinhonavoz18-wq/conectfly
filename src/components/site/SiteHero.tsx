import React, { useEffect, useRef } from "react";

interface Props {
  name: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroMediaType?: string;
  heroVideoUrl?: string | null;
  buttonText?: string;
  showButton?: boolean;
  hasCombos?: boolean;
  combosVisibility?: "auto" | "always" | "hide";
}

export function SiteHero({
  name,
  tagline,
  description,
  logoUrl,
  heroImageUrl,
  heroMediaType = "image",
  heroVideoUrl,
  buttonText = "Explorar Pizzas",
  showButton = true,
  hasCombos = false,
  combosVisibility = "auto",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showCombos = combosVisibility === "always" || (combosVisibility === "auto" && hasCombos);
  const showHeroButton = showButton;
  const showVideo = heroMediaType === "video" && heroVideoUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ensure video is muted and plays inline for mobile autoplay support
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const attemptPlay = async () => {
      try {
        await video.play();
        console.log("Hero video started playing successfully");
      } catch (error) {
        console.log("Hero video autoplay blocked or failed, using poster fallback:", error);
      }
    };

    if (showVideo) {
      attemptPlay();
    }
  }, [showVideo, heroVideoUrl]);

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    let targetId = id;
    
    // If we're looking for pizzas but it doesn't exist, try cardapio
    if (id === "pizzas" && !document.getElementById("pizzas")) {
      targetId = "cardapio";
    }

    const element = document.getElementById(targetId);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative min-h-[70vh] sm:min-h-[85vh] flex items-center justify-center overflow-hidden pt-12 sm:pt-16">
      <div className="absolute inset-0 site-scroll-parallax-bg">
        {showVideo ? (
          <video
            ref={videoRef}
            src={heroVideoUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            controls={false}
            poster={heroImageUrl ?? undefined}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ pointerEvents: 'none' }}
          />
        ) : heroImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageUrl})` }}
          />
        ) : null}
      </div>
       <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--site-bg)/0.4)] via-[hsl(var(--site-bg)/0.7)] to-[hsl(var(--site-bg))]" />
       <div className="absolute inset-0 bg-radial-at-c from-primary/5 to-transparent opacity-40" />
       <div className="relative z-10 text-center px-4 py-12 sm:py-20 site-hero-enter max-w-5xl mx-auto">
         {logoUrl ? (
           <div className="relative group inline-block">
             <div className="absolute inset-0 bg-primary/10 blur-[80px] group-hover:bg-primary/30 transition-all rounded-full" />
              <img
                src={logoUrl}
                alt={name}
                loading="eager"
                className="relative mx-auto mb-6 sm:mb-8 h-32 sm:h-56 md:h-72 w-auto object-contain drop-shadow-[0_0_25px_rgba(255,122,0,0.2)] group-hover:scale-105 transition-transform duration-700"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
           </div>
         ) : (
          <h1 className="text-4xl sm:text-7xl md:text-8xl font-black tracking-tighter mb-6 sm:mb-8 bg-gradient-to-r from-[hsl(var(--site-primary))] via-[hsl(var(--site-primary)/0.8)] to-[hsl(var(--site-fg)/0.6)] bg-clip-text text-transparent drop-shadow-lg">
             {name}
           </h1>
         )}
         {tagline && (
           <p className="text-xl sm:text-3xl font-black text-[hsl(var(--site-primary))] mb-3 sm:mb-4 uppercase tracking-[0.1em] sm:tracking-[0.15em] leading-tight">
             {tagline}
           </p>
         )}
         {description && (
           <p className="max-w-xl mx-auto text-base sm:text-xl text-[hsl(var(--site-muted-fg))] leading-relaxed font-medium px-2">
             {description}
           </p>
         )}
          {(showHeroButton || showCombos) && (
            <div className="mt-12 flex gap-5 justify-center flex-wrap">
              {showCombos && (
                <a
                  href="#combos"
                  onClick={(e) => scrollTo(e, "combos")}
                  className="px-10 py-5 rounded-full site-btn-primary font-extrabold text-lg transition-all transform hover:scale-105 hover:shadow-[0_12px_40px_hsl(var(--site-primary)/0.4)] active:scale-95 shadow-2xl uppercase tracking-widest border border-[hsl(var(--site-border))]"
                >
                  Combos Premium
                </a>
              )}
              {showHeroButton && (
                <a
                  href="#pizzas"
                  onClick={(e) => scrollTo(e, "pizzas")}
                  className="px-10 py-5 rounded-full site-btn-primary font-extrabold text-lg transition-all transform hover:scale-105 hover:shadow-[0_15px_45px_hsl(var(--site-primary)/0.5)] active:scale-95 shadow-2xl uppercase tracking-widest border border-[hsl(var(--site-border))]"
                >
                  {buttonText}
                </a>
              )}
            </div>
          )}
        <div 
          onClick={() => {
            const el = document.getElementById("pizzas") || document.getElementById("cardapio");
            if (el) {
              const offset = 80;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - offset;
              window.scrollTo({ top: offsetPosition, behavior: "smooth" });
            }
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-1 text-[hsl(var(--site-muted-fg))] animate-bounce cursor-pointer group z-20"
        >
          <span className="text-[10px] uppercase tracking-[0.2em]">Role</span>
          <span className="block w-px h-6 bg-[hsl(var(--site-muted-fg))]" />
        </div>
      </div>
    </div>
  );
}