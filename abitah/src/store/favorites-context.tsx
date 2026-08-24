"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

const STORAGE_KEY = "abitah:favorites:v1";

type FavoritesContextValue = {
  ids: string[];
  hydrated: boolean;
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { value: ids, setValue: setIds, hydrated } = useLocalStorage<string[]>(STORAGE_KEY, []);

  const isFavorite = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback(
    (productId: string) => {
      const willAdd = !ids.includes(productId);
      setIds((current) =>
        current.includes(productId)
          ? current.filter((id) => id !== productId)
          : [...current, productId],
      );
      return willAdd;
    },
    [ids, setIds],
  );

  const remove = useCallback(
    (productId: string) => setIds((current) => current.filter((id) => id !== productId)),
    [setIds],
  );

  const clear = useCallback(() => setIds([]), [setIds]);

  const value = useMemo(
    () => ({ ids, hydrated, isFavorite, toggle, remove, clear }),
    [ids, hydrated, isFavorite, toggle, remove, clear],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites deve ser usado dentro de <FavoritesProvider>");
  return context;
}
