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
    ["--site-bg" as string]: "12 8% 8%",
    ["--site-fg" as string]: "30 20% 96%",
    ["--site-card" as string]: "12 8% 12%",
    ["--site-border" as string]: "12 8% 20%",
    ["--site-muted" as string]: "12 8% 16%",
    ["--site-muted-fg" as string]: "30 10% 70%",
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