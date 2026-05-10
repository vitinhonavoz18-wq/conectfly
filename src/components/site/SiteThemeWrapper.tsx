import type { CSSProperties, ReactNode } from "react";

interface Props {
  primaryColor: string; // HSL "h s% l%"
  secondaryColor: string;
  children: ReactNode;
}

/**
 * Injects per-restaurant brand colors as CSS variables for the generated site.
 * Uses HSL so users can pick simple hue/saturation/lightness values.
 */
export function SiteThemeWrapper({ primaryColor, secondaryColor, children }: Props) {
  const style: CSSProperties = {
    // Site-only tokens — do not collide with platform tokens
     ["--site-bg" as string]: "0 0% 2%", // #050505
     ["--site-fg" as string]: "0 0% 97%", // Soft white
     ["--site-card" as string]: "0 0% 6%", // #111111
     ["--site-border" as string]: "0 0% 10%",
     ["--site-muted" as string]: "0 0% 8%",
     ["--site-muted-fg" as string]: "0 0% 70%",
    ["--site-primary" as string]: primaryColor,
    ["--site-secondary" as string]: secondaryColor,
  };
  return (
    <div
      style={style}
      className="min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))]"
    >
      {children}
    </div>
  );
}