import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PFPhotoSlotProps {
  /** Endereço da imagem já enviada, ou `null` enquanto ela não existir. */
  src: string | null;
  alt: string;
  /** Caminho onde o arquivo deve ser salvo — aparece na moldura de espera. */
  caminhoEsperado: string;
  /** Descrição do que entra aqui. Ex.: "Fotografia principal". */
  descricao: string;
  className?: string;
  imgClassName?: string;
  /** Carrega a imagem com prioridade (usar apenas na primeira dobra). */
  prioridade?: boolean;
}

/**
 * Espaço reservado para uma fotografia.
 *
 * Se o arquivo já estiver na pasta, mostra a foto. Se ainda não estiver,
 * mostra uma moldura tracejada dizendo exatamente qual arquivo falta e onde
 * salvá-lo.
 *
 * É a diferença entre a parede com o prego e a etiqueta "quadro da sala" e a
 * parede com um buraco: o layout já está pronto e no tamanho certo, e a foto
 * entra depois sem nada sair do lugar.
 */
export function PFPhotoSlot({
  src,
  alt,
  caminhoEsperado,
  descricao,
  className,
  imgClassName,
  prioridade = false,
}: PFPhotoSlotProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(imgClassName, className)}
        loading={prioridade ? "eager" : "lazy"}
        // `fetchPriority` acelera a primeira imagem visível da página.
        fetchPriority={prioridade ? "high" : "auto"}
        decoding="async"
        draggable={false}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-4 border border-dashed border-[var(--pf-line-accent)] bg-[var(--pf-accent-veil)] p-6 text-center",
        className,
      )}
      data-pf-placeholder="fotografia"
      role="img"
      aria-label={`${descricao} — imagem ainda não enviada`}
    >
      <ImageOff
        size={28}
        strokeWidth={1.2}
        className="text-[var(--pf-accent-soft)]"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1.5">
        <span
          className="pf-serif text-[var(--pf-fg)]"
          style={{
            fontSize: "1.25rem",
            lineHeight: 1.2,
          }}
        >
          {descricao}
        </span>
        <span className="text-[var(--pf-fg-muted)]" style={{ fontSize: "var(--pf-text-xs)" }}>
          Salve o arquivo em
        </span>
        <code
          className="mx-auto inline-block border border-[var(--pf-line)] bg-[var(--pf-bg)] px-2 py-1 text-[var(--pf-accent-soft)]"
          style={{ fontSize: "0.75rem" }}
        >
          {caminhoEsperado}
        </code>
      </div>
    </div>
  );
}
