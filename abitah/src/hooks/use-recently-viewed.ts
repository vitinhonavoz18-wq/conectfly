"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

const STORAGE_KEY = "abitah:recent:v1";
const MAX_ITEMS = 8;

export function useRecentlyViewed() {
  const { value, setValue, hydrated } = useLocalStorage<string[]>(STORAGE_KEY, []);
  return { slugs: value, setSlugs: setValue, hydrated };
}

/** Registra a visita a um produto mantendo os mais recentes no topo. */
export function useTrackRecentlyViewed(slug: string) {
  const { setSlugs } = useRecentlyViewed();

  useEffect(() => {
    if (!slug) return;
    setSlugs((current) => [slug, ...current.filter((item) => item !== slug)].slice(0, MAX_ITEMS));
  }, [slug, setSlugs]);
}
