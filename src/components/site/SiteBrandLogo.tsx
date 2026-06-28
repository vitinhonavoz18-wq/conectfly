import { useState } from "react";

type Variant = "header" | "hero" | "compact";

interface Props {
  name: string;
  logoUrl: string | null | undefined;
  variant?: Variant;
  className?: string;
  priority?: boolean;
}

/**
 * Shared restaurant branding logo. Single rendering strategy used by
 * every template's SiteHeader and SiteHero so we never drift between
 * implementations again.
 *
 * - `header`  — stacked-header layout, mobile 90px → desktop 180px.
 * - `hero`    — large in-page hero, mobile 128px → desktop 288px.
 * - `compact` — collapsed scroll-state, ~40-56px inline.
 *
 * Always preserves the original aspect ratio (`object-contain`), never
 * crops or stretches. Falls back to a tasteful initials chip if the image
 * fails to load.
 */
export function SiteBrandLogo({ name, logoUrl, variant = "header", className = "", priority = false }: Props) {
  const [errored, setErrored] = useState(false);

  const sizeClass =
    variant === "hero"
      ? "h-32 sm:h-56 md:h-72"
      : variant === "compact"
        ? "h-10 sm:h-12"
        : "h-[90px] sm:h-[120px] md:h-[150px] lg:h-[180px]";

  const maxWidth =
    variant === "hero"
      ? "max-w-[80vw]"
      : variant === "compact"
        ? "max-w-[160px]"
        : "max-w-[260px] sm:max-w-[320px] md:max-w-[400px]";

  if (!logoUrl || errored) {
    return (
      <div
        aria-label={name}
        role="img"
        className={[
          sizeClass,
          "aspect-square inline-flex items-center justify-center rounded-2xl",
          "bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))]",
          "font-black tracking-tight shadow-lg select-none",
          variant === "hero" ? "text-4xl sm:text-6xl" : variant === "compact" ? "text-base" : "text-2xl sm:text-3xl",
          className,
        ].join(" ")}
      >
        {(name || "?").trim().charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`Logo ${name}`}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setErrored(true)}
      className={[
        sizeClass,
        maxWidth,
        "w-auto object-contain select-none",
        // Reserve aspect on load to minimize CLS while we still allow any ratio.
        "transition-[height,opacity] duration-300 ease-out",
        className,
      ].join(" ")}
      style={{ imageRendering: "auto" }}
    />
  );
}