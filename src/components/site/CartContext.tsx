import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from "react";
import type { CartLine } from "@/lib/site/types";

export interface ValidatedTable {
  id: string;
  number: string;
  token: string;
  name?: string | null;
  sessionId?: string | null;
}


interface CartCtx {
  items: CartLine[];
  addLine: (line: Omit<CartLine, "quantity">, qty?: number) => void;
  updateQty: (itemId: string, sizeLabel: string | undefined, qty: number) => void;
  removeLine: (itemId: string, sizeLabel?: string) => void;
  clear: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  validatedTable: ValidatedTable | null;
  setValidatedTable: (table: ValidatedTable | null) => void;
}

const Ctx = createContext<CartCtx | null>(null);

function keyOf(itemId: string, sizeLabel?: string) {
  return `${itemId}-${sizeLabel ?? ""}`;
}

const TABLE_STORAGE_KEY = "sf:validated_table";
const CART_STORAGE_KEY = "sf:cart_items";

function readStoredTable(): ValidatedTable | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TABLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string" && typeof parsed.number === "string") {
      return parsed as ValidatedTable;
    }
  } catch {}
  return null;
}

function readStoredItems(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(() => readStoredItems());
  const [isCartOpen, setCartOpen] = useState(false);
  const [validatedTable, setValidatedTableState] = useState<ValidatedTable | null>(() => readStoredTable());

  // Persist validated table across refreshes (so QR scan survives reload).
  const setValidatedTable = (table: ValidatedTable | null) => {
    setValidatedTableState(table);
    if (typeof window === "undefined") return;
    try {
      if (table) window.localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(table));
      else window.localStorage.removeItem(TABLE_STORAGE_KEY);
    } catch {}
  };

  // Persist cart items across refreshes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (items.length) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      else window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {}
  }, [items]);

  const addLine: CartCtx["addLine"] = (line, qty = 1) => {
    setItems((cur) => {
      const idx = cur.findIndex(
        (l) => keyOf(l.itemId, l.sizeLabel) === keyOf(line.itemId, line.sizeLabel),
      );
      if (idx >= 0) {
        const copy = [...cur];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [...cur, { ...line, quantity: qty }];
    });
  };

  const updateQty: CartCtx["updateQty"] = (itemId, sizeLabel, qty) => {
    setItems((cur) => {
      if (qty <= 0) {
        return cur.filter(
          (l) => keyOf(l.itemId, l.sizeLabel) !== keyOf(itemId, sizeLabel),
        );
      }
      return cur.map((l) =>
        keyOf(l.itemId, l.sizeLabel) === keyOf(itemId, sizeLabel)
          ? { ...l, quantity: qty }
          : l,
      );
    });
  };

  const removeLine: CartCtx["removeLine"] = (itemId, sizeLabel) => {
    setItems((cur) =>
      cur.filter((l) => keyOf(l.itemId, l.sizeLabel) !== keyOf(itemId, sizeLabel)),
    );
  };

  const value = useMemo<CartCtx>(() => {
    const totalItems = items.reduce((s, l) => s + l.quantity, 0);
    const totalPrice = items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    return {
      items,
      addLine,
      updateQty,
      removeLine,
      clear: () => setItems([]),
      totalItems,
      totalPrice,
      isCartOpen,
      setCartOpen,
      validatedTable,
      setValidatedTable,
    };
  }, [items, isCartOpen, validatedTable]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside CartProvider");
  return v;
}