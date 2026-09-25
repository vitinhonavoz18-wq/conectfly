"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carrega dados assíncronos e mantém o resultado em estado.
 *
 * O `loader` precisa ser estável (envolva em `useCallback`), pois é a
 * dependência que dispara o recarregamento. `refresh()` reexecuta a busca —
 * usado após criar, editar ou excluir registros no painel.
 */
export function useAsyncData<T>(loader: () => Promise<T>, fallback: T) {
  const [data, setData] = useState<T | null>(null);
  const mounted = useRef(true);
  const fallbackRef = useRef(fallback);

  const refresh = useCallback(
    () =>
      loader()
        .then((result) => {
          if (mounted.current) setData(result);
          return result;
        })
        .catch(() => {
          if (mounted.current) setData(fallbackRef.current);
          return fallbackRef.current;
        }),
    [loader],
  );

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { data, refresh, setData } as const;
}
