import Image from "next/image";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Moldura de imagem com placeholder elegante.
 * Sempre que `src` for nulo, mostra um espaço identificado como
 * "Adicionar imagem" — sem depender de nenhum link externo.
 */
export function MediaFrame({
  src,
  alt,
  label,
  className,
  imageClassName,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority = false,
  fill = true,
  rounded = true,
}: {
  src?: string | null;
  alt: string;
  label?: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  rounded?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-ink-850",
        rounded && "rounded-card",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className={cn("object-cover", imageClassName)}
        />
      ) : (
        <div
          role="img"
          aria-label={`${alt} — imagem ainda não cadastrada`}
          className="grain absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_0%,#141a16,#070a08_70%)] text-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/8 bg-ink-900 text-neon-500">
            <ImagePlus className="h-5 w-5" aria-hidden />
          </span>
          <span className="px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-smoke-400">
            {label ?? "Adicionar imagem"}
          </span>
        </div>
      )}
    </div>
  );
}
