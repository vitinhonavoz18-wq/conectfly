"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

/**
 * Estado persistido no navegador, seguro para SSR.
 *
 * Usa `useSyncExternalStore` para ler o localStorage sem efeitos colaterais no
 * primeiro render: o servidor renderiza o valor padrão e o cliente sincroniza
 * logo após a hidratação, sem divergência de marcação.
 */

type Listener = () => void;

const cache = new Map<string, string | null>();
const listeners = new Map<string, Set<Listener>>();

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribeTo(key: string) {
  return (listener: Listener) => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(listener);

    const onStorage = (event: StorageEvent) => {
      if (event.key === key) {
        cache.set(key, event.newValue);
        emit(key);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      listeners.get(key)?.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };
}

function readRaw(key: string): string | null {
  if (cache.has(key)) return cache.get(key) ?? null;
  let value: string | null = null;
  try {
    value = window.localStorage.getItem(key);
  } catch {
    // Storage indisponível (modo privado / cookies bloqueados).
  }
  cache.set(key, value);
  return value;
}

function writeRaw(key: string, value: string | null) {
  cache.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Cota excedida: o valor segue apenas em memória nesta sessão.
  }
  emit(key);
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Mantém o valor padrão estável mesmo quando o chamador passa um literal.
  const [fallback] = useState(initialValue);

  const raw = useSyncExternalStore(
    useMemo(() => subscribeTo(key), [key]),
    useCallback(() => readRaw(key), [key]),
    useCallback(() => null, []),
  );

  const hydrated = useSyncExternalStore(
    useMemo(() => subscribeTo(key), [key]),
    () => true,
    () => false,
  );

  const value = useMemo<T>(() => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = (() => {
        const stored = readRaw(key);
        if (stored === null) return fallback;
        try {
          return JSON.parse(stored) as T;
        } catch {
          return fallback;
        }
      })();

      const resolved =
        typeof next === "function" ? (next as (current: T) => T)(current) : next;

      writeRaw(key, JSON.stringify(resolved));
    },
    [key, fallback],
  );

  const reset = useCallback(() => writeRaw(key, null), [key]);

  return { value, setValue, hydrated, reset } as const;
}
