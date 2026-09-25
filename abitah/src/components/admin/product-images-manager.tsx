"use client";

import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";
import { MediaFrame } from "@/components/ui/media-frame";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/hooks/use-async-data";
import {
  deleteProductImage,
  reorderImages,
  setPrimaryImage,
  uploadProductImage,
} from "@/services/admin";
import type { ProductImage } from "@/types/catalog";

export function ProductImagesManager({
  productId,
  initialImages,
}: {
  productId: string;
  initialImages: ProductImage[];
}) {
  const supabase = getSupabaseBrowserClient();
  const { notify } = useToast();
  const [uploading, setUploading] = useState(false);

  const loader = useCallback(async (): Promise<ProductImage[]> => {
    if (!supabase) return initialImages.filter((image) => image.url);
    const { data } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("position");

    return (data ?? []).map((row) => ({
        id: row.id as string,
        url: (row.url as string) ?? null,
        alt: (row.alt as string) ?? "",
        position: Number(row.position ?? 0),
      isPrimary: row.is_primary === true,
    }));
    // `initialImages` só é usado como fallback inicial — não precisa disparar recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, productId]);

  const { data, refresh: load, setData: setImages } = useAsyncData<ProductImage[]>(loader, []);
  const images = data ?? [];

  async function handleUpload(files: FileList | null) {
    if (!supabase || !files?.length) return;
    setUploading(true);
    try {
      let position = images.length;
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          notify(`${file.name} excede 5 MB e foi ignorado.`, "error");
          continue;
        }
        await uploadProductImage(supabase, productId, file, position);
        position += 1;
      }
      notify("Imagens enviadas.");
      await load();
    } catch {
      notify("Falha no envio. Verifique se o bucket 'product-images' existe e é público.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (!supabase || target < 0 || target >= images.length) return;

    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    await reorderImages(
      supabase,
      next.map((image, position) => ({ id: image.id, position })),
    );
  }

  return (
    <section className="rounded-card border border-ink-700 bg-ink-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
          Imagens do produto
        </h2>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-neon-500 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-950 transition-colors hover:bg-neon-400">
          <ImagePlus className="h-4 w-4" aria-hidden />
          {uploading ? "Enviando..." : "Enviar imagens"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              void handleUpload(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-smoke-400">
        A primeira imagem (ou a marcada com estrela) é a principal. Máximo de 5 MB por arquivo.
      </p>

      {images.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-ink-600 px-5 py-10 text-center text-sm text-smoke-300">
          Nenhuma imagem cadastrada ainda.
        </p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="rounded-lg border border-ink-700 bg-ink-850 p-2">
              <MediaFrame
                src={image.url}
                alt={image.alt || `Imagem ${index + 1}`}
                className="aspect-3/4 w-full"
                sizes="200px"
              />
              <div className="mt-2 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!supabase) return;
                    await setPrimaryImage(supabase, productId, image.id);
                    await load();
                    notify("Imagem principal atualizada.");
                  }}
                  aria-label="Definir como imagem principal"
                  className={`rounded p-1.5 transition-colors ${
                    image.isPrimary ? "text-neon-500" : "text-smoke-400 hover:text-neon-400"
                  }`}
                >
                  <Star className={`h-4 w-4 ${image.isPrimary ? "fill-current" : ""}`} />
                </button>

                <div className="flex">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover para cima"
                    className="rounded p-1.5 text-smoke-400 transition-colors hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1}
                    aria-label="Mover para baixo"
                    className="rounded p-1.5 text-smoke-400 transition-colors hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (!supabase) return;
                    await deleteProductImage(supabase, image.id);
                    await load();
                    notify("Imagem removida.", "info");
                  }}
                  aria-label="Remover imagem"
                  className="rounded p-1.5 text-smoke-400 transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {images.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => {
            void load();
          }}
        >
          Recarregar lista
        </Button>
      ) : null}
    </section>
  );
}
