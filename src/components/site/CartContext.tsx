import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from "react";
import type { CartLine } from "@/lib/site/types";

export interface ValidatedTable {
  id: string;
  number: string;
  token: string;
  name?: string | null;
  sessionId?: string | null;
  restaurantId?: string | null;
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
  sessionConsumed: number;
  sessionOrderCount: number;
  addSessionOrder: (orderTotal: number) => void;
  resetSessionConsumption: () => void;
  /** True after FlyControl closed the table; blocks new orders until QR rescan. */
  sessionClosed: boolean;
  /** Centralized session destruction. Wipes table, cart, storage and shows modal. */
  terminateSession: (opts?: { silent?: boolean }) => void;
  /** Manually dismisses the "MESA ENCERRADA" modal (after closure). */
  acknowledgeClosure: () => void;
  /** Clears the closed flag so a fresh QR scan can start a new session. */
  clearSessionClosed: () => void;
  /** True while a cached table session is being checked with the server. */
  sessionHydrating: boolean;
  /**
   * Server-authoritative session check. Returns true when the table session is
   * still ACTIVE on the server. Returns false (and terminates the local
   * session) when the server reports the table as closed or unknown.
   * Always trust this over localStorage.
   */
  revalidateSession: (table?: ValidatedTable | null) => Promise<boolean>;
}

const Ctx = createContext<CartCtx | null>(null);

function keyOf(itemId: string, sizeLabel?: string) {
  return `${itemId}-${sizeLabel ?? ""}`;
}

const TABLE_STORAGE_KEY = "sf:validated_table";
const CART_STORAGE_KEY = "sf:cart_items";
const SESSION_CONSUMED_KEY = "sf:session_consumed";
const SESSION_CLOSED_KEY = "sf:session_closed";

const INVALID_TABLE_NUMBERS = new Set(["", "n/a", "na", "mesa", "null", "undefined"]);
export function isValidTableNumber(n: unknown): n is string {
  if (typeof n !== "string") return false;
  const t = n.trim();
  if (!t) return false;
  return !INVALID_TABLE_NUMBERS.has(t.toLowerCase());
}

interface StoredSessionConsumed {
  token: string;
  total: number;
  count: number;
}

function readStoredConsumption(): StoredSessionConsumed | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_CONSUMED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string" && typeof parsed.total === "number" && typeof parsed.count === "number") {
      return parsed as StoredSessionConsumed;
    }
  } catch {}
  return null;
}

function readStoredTable(): ValidatedTable | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TABLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.token === "string" &&
      parsed.token.trim() &&
      typeof parsed.sessionId === "string" &&
      parsed.sessionId.trim() &&
      typeof parsed.restaurantId === "string" &&
      parsed.restaurantId.trim() &&
      isValidTableNumber(parsed.number)
    ) {
      return parsed as ValidatedTable;
    }
    // Corrupted/legacy state ("Mesa", "N/A", empty): purge so the customer is
    // forced to revalidate via QR / direct URL.
    try { window.localStorage.removeItem(TABLE_STORAGE_KEY); } catch {}
    try { window.localStorage.removeItem(CART_STORAGE_KEY); } catch {}
    try { window.localStorage.removeItem(SESSION_CONSUMED_KEY); } catch {}
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
  const [pendingStoredTable] = useState<ValidatedTable | null>(() => readStoredTable());
  const [items, setItems] = useState<CartLine[]>(() => readStoredItems());
  const [isCartOpen, setCartOpen] = useState(false);
  const [validatedTable, setValidatedTableState] = useState<ValidatedTable | null>(null);
  const [sessionHydrating, setSessionHydrating] = useState<boolean>(() => !!pendingStoredTable);
  const [sessionConsumed, setSessionConsumed] = useState<number>(() => {
    const t = pendingStoredTable;
    const s = readStoredConsumption();
    if (t && s && s.token === t.token) return s.total;
    return 0;
  });
  const [sessionOrderCount, setSessionOrderCount] = useState<number>(() => {
    const t = pendingStoredTable;
    const s = readStoredConsumption();
    if (t && s && s.token === t.token) return s.count;
    return 0;
  });
  const [sessionClosed, setSessionClosed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(SESSION_CLOSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [showClosedModal, setShowClosedModal] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(SESSION_CLOSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const persistConsumption = (token: string | null, total: number, count: number) => {
    if (typeof window === "undefined") return;
    try {
      if (token) {
        window.localStorage.setItem(SESSION_CONSUMED_KEY, JSON.stringify({ token, total, count }));
      } else {
        window.localStorage.removeItem(SESSION_CONSUMED_KEY);
      }
    } catch {}
  };

  // Persist validated table across refreshes (so QR scan survives reload).
  const setValidatedTable = (table: ValidatedTable | null) => {
    if (table && (!isValidTableNumber(table.number) || !table.token?.trim() || !table.sessionId?.trim() || !table.restaurantId?.trim())) {
      console.warn("CART_CTX_REJECTED_INVALID_TABLE", table);
      return;
    }
    setValidatedTableState(table);
    if (typeof window === "undefined") return;
    try {
      if (table) window.localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(table));
      else window.localStorage.removeItem(TABLE_STORAGE_KEY);
    } catch {}
    // When the table changes (or is cleared), reset accumulated consumption
    // unless the same token is being re-applied (refresh restoration).
    const stored = readStoredConsumption();
    if (!table) {
      setSessionConsumed(0);
      setSessionOrderCount(0);
      persistConsumption(null, 0, 0);
    } else if (!stored || stored.token !== table.token) {
      setSessionConsumed(0);
      setSessionOrderCount(0);
      persistConsumption(table.token, 0, 0);
    }
  };

  const addSessionOrder = (orderTotal: number) => {
    if (!validatedTable) return;
    const nextTotal = sessionConsumed + (Number(orderTotal) || 0);
    const nextCount = sessionOrderCount + 1;
    setSessionConsumed(nextTotal);
    setSessionOrderCount(nextCount);
    persistConsumption(validatedTable.token, nextTotal, nextCount);
  };

  const resetSessionConsumption = () => {
    setSessionConsumed(0);
    setSessionOrderCount(0);
    persistConsumption(validatedTable?.token ?? null, 0, 0);
  };

  // Centralized session destruction. Works from anywhere in the Digital Menu
  // (home page, menu sections, cart drawer). Wipes table, cart and storage,
  // then surfaces the blocking "MESA ENCERRADA" modal.
  const terminateSession = (_opts?: { silent?: boolean }) => {
    console.log("CART_CTX_TERMINATE_SESSION");
    setValidatedTableState(null);
    setItems([]);
    setSessionConsumed(0);
    setSessionOrderCount(0);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(TABLE_STORAGE_KEY);
        window.localStorage.removeItem(CART_STORAGE_KEY);
        window.localStorage.removeItem(SESSION_CONSUMED_KEY);
        window.sessionStorage.removeItem(TABLE_STORAGE_KEY);
        window.sessionStorage.setItem(SESSION_CLOSED_KEY, "1");
      } catch {}
    }
    setSessionClosed(true);
    setShowClosedModal(true);
  };

  const acknowledgeClosure = () => {
    setShowClosedModal(false);
  };

  const clearSessionClosed = () => {
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(SESSION_CLOSED_KEY); } catch {}
    }
    setSessionClosed(false);
    setShowClosedModal(false);
  };

  // Server-authoritative session check. Never trust localStorage alone — this
  // call is the only source of truth for "is the table session still active?".
  const revalidateSession = async (tableOverride?: ValidatedTable | null): Promise<boolean> => {
    const table = tableOverride ?? validatedTable;
    if (!table?.token || !table.restaurantId || !table.sessionId) {
      terminateSession({ silent: true });
      return false;
    }
    try {
      const res = await fetch("/api/public/check-table-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: table.restaurantId,
          table_token: table.token ?? null,
          table_session_id: table.sessionId,
          table_number: table.number ?? null,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (data?.closed || !data?.success) {
        terminateSession({ silent: true });
        return false;
      }
      return true;
    } catch (err) {
      console.warn("CART_CTX_REVALIDATE_ERROR", err);
      // Network/server unreachable: do NOT trust local cache. Block.
      terminateSession({ silent: true });
      return false;
    }
  };

  // Restore cached table session only after the server confirms that the exact
  // session_id still exists and is open. localStorage is cache, never authority.
  useEffect(() => {
    if (!pendingStoredTable) {
      setSessionHydrating(false);
      return;
    }
    let cancelled = false;
    const restore = async () => {
      const active = await revalidateSession(pendingStoredTable);
      if (cancelled) return;
      if (active) {
        setValidatedTableState(pendingStoredTable);
        const stored = readStoredConsumption();
        if (stored && stored.token === pendingStoredTable.token) {
          setSessionConsumed(stored.total);
          setSessionOrderCount(stored.count);
        } else {
          setSessionConsumed(0);
          setSessionOrderCount(0);
          persistConsumption(pendingStoredTable.token, 0, 0);
        }
      }
      setSessionHydrating(false);
    };
    restore();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global poll: while a table is active and we know its restaurant, ask the
  // server every 8s whether the session was closed in FlyControl. As soon as
  // the closure is mirrored into public.table_sessions, terminate the
  // customer session — no matter which screen they are on.
  useEffect(() => {
    if (!validatedTable?.token || !validatedTable.restaurantId) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || typeof document === "undefined") return;
      if (document.hidden) return;
      try {
        const res = await fetch("/api/public/check-table-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurant_id: validatedTable.restaurantId,
            table_token: validatedTable.token ?? null,
            table_session_id: validatedTable.sessionId ?? null,
            table_number: validatedTable.number ?? null,
          }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (cancelled) return;
        if (data?.closed) terminateSession({ silent: true });
      } catch (err) {
        console.warn("CART_CTX_SESSION_POLL_ERROR", err);
      }
    };
    tick();
    const id = window.setInterval(tick, 8000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validatedTable?.token, validatedTable?.restaurantId, validatedTable?.sessionId]);

  // Persist cart items across refreshes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (items.length) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      else window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {}
  }, [items]);

  const addLine: CartCtx["addLine"] = (line, qty = 1) => {
    if (sessionClosed || sessionHydrating) {
      console.warn("CART_CTX_ADDLINE_BLOCKED_SESSION_CLOSED");
      return;
    }
    const applyLine = () => setItems((cur) => {
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
    if (validatedTable) {
      revalidateSession(validatedTable).then((active) => {
        if (active) applyLine();
      });
      return;
    }
    applyLine();
  };

  const updateQty: CartCtx["updateQty"] = (itemId, sizeLabel, qty) => {
    if (sessionClosed || sessionHydrating) {
      console.warn("CART_CTX_UPDATEQTY_BLOCKED_SESSION_CLOSED");
      return;
    }
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
    if (sessionClosed || sessionHydrating) {
      console.warn("CART_CTX_REMOVELINE_BLOCKED_SESSION_CLOSED");
      return;
    }
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
      sessionConsumed,
      sessionOrderCount,
      addSessionOrder,
      resetSessionConsumption,
      sessionClosed,
      sessionHydrating,
      terminateSession,
      acknowledgeClosure,
      clearSessionClosed,
      revalidateSession,
    };
  }, [items, isCartOpen, validatedTable, sessionConsumed, sessionOrderCount, sessionClosed, sessionHydrating]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {showClosedModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mesa-encerrada-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white text-neutral-900 shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2 flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              </div>
              <h3 id="mesa-encerrada-title" className="font-black text-xl tracking-tight uppercase">
                Mesa Encerrada
              </h3>
            </div>
            <div className="px-6 pb-4 text-center text-sm text-neutral-600 leading-relaxed">
              <p>Sua mesa foi encerrada pelo estabelecimento.</p>
              <p className="mt-2">
                Caso deseje continuar consumindo, solicite uma nova mesa ou escaneie novamente o QR Code.
              </p>
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={acknowledgeClosure}
                className="w-full rounded-xl bg-neutral-900 text-white font-black uppercase tracking-wider text-sm py-3 hover:bg-neutral-800 active:scale-[0.98] transition"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside CartProvider");
  return v;
}