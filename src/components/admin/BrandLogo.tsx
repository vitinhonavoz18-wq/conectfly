import logo from "@/assets/logo-sitecreatorfly.png";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  glow?: boolean;
}

const sizeMap = {
  sm: "h-8",
  md: "h-12",
  lg: "h-20",
  xl: "h-32",
};

/**
 * Official SiteCreatorFly platform logo.
 * Used ONLY in the admin platform — never in generated pizzeria sites.
 */
export function BrandLogo({ className = "", size = "md", glow = true }: BrandLogoProps) {
  return (
    <img
      src={logo}
      alt="SiteCreatorFly"
      className={`${sizeMap[size]} w-auto object-contain select-none ${
        glow ? "drop-shadow-[0_0_24px_oklch(0.62_0.16_48_/_0.35)]" : ""
      } ${className}`}
      draggable={false}
    />
  );
}
