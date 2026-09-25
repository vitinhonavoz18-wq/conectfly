import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Logo oficial. Para trocar, substitua os arquivos em /public/brand
 * (ver README) — nenhum código precisa ser alterado.
 *
 * `unoptimized` porque o arquivo padrão é SVG (já vetorial e leve); o
 * otimizador de imagens do Next não processa SVG. Ao trocar por PNG/JPG,
 * basta remover essa propriedade para ativar a otimização automática.
 */
export function Logo({
  variant = "horizontal",
  className,
  width = 168,
  height = 46,
  priority = false,
}: {
  variant?: "horizontal" | "full" | "mark";
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  const src =
    variant === "mark"
      ? siteConfig.logo.mark
      : variant === "full"
        ? siteConfig.logo.full
        : siteConfig.logo.horizontal;
  const isVector = src.endsWith(".svg");

  return (
    <Image
      src={src}
      alt={siteConfig.name}
      width={width}
      height={height}
      priority={priority}
      unoptimized={isVector}
      className={cn("w-auto select-none", className)}
    />
  );
}

export function LogoLink({
  className,
  ...props
}: React.ComponentProps<typeof Logo> & { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} — página inicial`}
      className="inline-flex items-center transition-opacity hover:opacity-85"
    >
      <Logo {...props} className={className} />
    </Link>
  );
}
