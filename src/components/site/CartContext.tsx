import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from "react";
import type { CartLine, RestaurantRow } from "@/lib/site/types";
import { openTableSession, type OpenTableSessionPayload } from "@/lib/site/flycontrol";
import { newTraceId, traceLog, traceWarn } from "@/lib/site/closeDebug";
import { checkTableSession as svcCheckTableSession } from "@/services/tableSessionService";
import { supabase } from "@/integrations/supabase/client";

export interface ValidatedTable {
  id: string;
  number: string;
  token: string;
  name?: string | null;
  sessionId?: string | null;
  restaurantId?: string | null;
  /** Authoritative Dining Session id — single source of truth for the session. */
  diningSessionId?: string | null;
  /** Private per-browser token bound to the dining session. */
  customerToken?: string | null;
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
  /**
   * Single source of truth for "scan QR → open FL session → persist locally".
   * Both the header QR button and the cart drawer flow call this so the
   * validatedTable lifecycle stays identical regardless of entry point.
   */
  validateAndOpenTable: (args: {
    restaurant: Pick<RestaurantRow, "id" | "slug">;
    table_number: string;
    table_token: string;
    restaurant_slug?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
  }) => Promise<{
    success: boolean;
    closed?: boolean;
    already_open?: boolean;
    session_id?: string | null;
    dining_session_id?: string | null;
    customer_token?: string | null;
    message?: string;
  }>;
}

const Ctx = createContext<CartCtx | null>(null);

function keyOf(itemId: string, sizeLabel?: string) {
  return `${itemId}-${sizeLabel ?? ""}`;
}

// Per-restaurant namespaced storage keys. Each restaurant gets its own bucket
// so opening restaurant B in the same browser cannot restore restaurant A's
// table/cart/session state. See CartProvider({ namespace }).
const LEGACY_TABLE_KEY = "sf:validated_table";
const LEGACY_CART_KEY = "sf:cart_items";
const LEGACY_CONSUMED_KEY = "sf:session_consumed";
const LEGACY_CLOSED_KEY = "sf:session_closed";
const LEGACY_DINING_KEY = "sf:dining_session";

const LEGACY_KEYS = [
  LEGACY_TABLE_KEY,
  LEGACY_CART_KEY,
  LEGACY_CONSUMED_KEY,
  LEGACY_CLOSED_KEY,
  LEGACY_DINING_KEY,
] as const;

type StorageName =
  | "validated_table"
  | "cart_items"
  | "session_consumed"
  | "session_closed"
  | "dining_session";

function makeStorageKey(namespace: string, name: StorageName) {
  const ns = (namespace || "default").trim() || "default";
  return `sf:${ns}:${name}`;
}

/**
 * If a legacy global key exists and its payload belongs to the current
 * restaurant namespace, migrate it into the namespaced key and delete the
 * legacy entry. If it belongs to another restaurant, leave it alone so that
 * restaurant's own tab can migrate it. Runs once per CartProvider mount.
 */
function migrateLegacyStorage(namespace: string) {
  if (typeof window === "undefined") return;
  const ls = window.localStorage;
  try {
    const legacyTableRaw = ls.getItem(LEGACY_TABLE_KEY);
    if (legacyTableRaw) {
      let ownedByUs = false;
      try {
        const parsed = JSON.parse(legacyTableRaw);
        ownedByUs = typeof parsed?.restaurantId === "string" && parsed.restaurantId === namespace;
      } catch {}
      if (ownedByUs) {
        const scopedTableKey = makeStorageKey(namespace, "validated_table");
        if (!ls.getItem(scopedTableKey)) ls.setItem(scopedTableKey, legacyTableRaw);
        const legacyDining = ls.getItem(LEGACY_DINING_KEY);
        if (legacyDining) {
          const k = makeStorageKey(namespace, "dining_session");
          if (!ls.getItem(k)) ls.setItem(k, legacyDining);
        }
        const legacyCart = ls.getItem(LEGACY_CART_KEY);
        if (legacyCart) {
          const k = makeStorageKey(namespace, "cart_items");
          if (!ls.getItem(k)) ls.setItem(k, legacyCart);
        }
        const legacyConsumed = ls.getItem(LEGACY_CONSUMED_KEY);
        if (legacyConsumed) {
          const k = makeStorageKey(namespace, "session_consumed");
          if (!ls.getItem(k)) ls.setItem(k, legacyConsumed);
        }
        for (const k of LEGACY_KEYS) {
          try { ls.removeItem(k); } catch {}
        }
      }
    }
    try { window.sessionStorage.removeItem(LEGACY_CLOSED_KEY); } catch {}
  } catch {}
}

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

function readStoredConsumption(SESSION_CONSUMED_KEY: string): StoredSessionConsumed | null {
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

function readStoredTable(
  TABLE_STORAGE_KEY: string,
  DINING_STORAGE_KEY: string,
  CART_STORAGE_KEY: string,
  SESSION_CONSUMED_KEY: string,
  expectedRestaurantId: string,
): ValidatedTable | null {
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
      parsed.restaurantId === expectedRestaurantId &&
      isValidTableNumber(parsed.number) &&
      typeof parsed.diningSessionId === "string" &&
      parsed.diningSessionId.trim() &&
      typeof parsed.customerToken === "string" &&
      parsed.customerToken.trim()
    ) {
      return parsed as ValidatedTable;
    }
    // Corrupted/legacy state ("Mesa", "N/A", empty): purge so the customer is
    // forced to revalidate via QR / direct URL.
    try { window.localStorage.removeItem(TABLE_STORAGE_KEY); } catch {}
    try { window.localStorage.removeItem(DINING_STORAGE_KEY); } catch {}
    try { window.localStorage.removeItem(CART_STORAGE_KEY); } catch {}
    try { window.localStorage.removeItem(SESSION_CONSUMED_KEY); } catch {}
  } catch {}
  return null;
}

function readStoredItems(CART_STORAGE_KEY: string): CartLine[] {
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

export function CartProvider({ children, namespace }: { children: ReactNode; namespace: string }) {
  // All storage keys are scoped to the current restaurant. This isolates
  // table, cart, dining session and consumption between establishments so
  // opening restaurant B never restores restaurant A's state.
  const TABLE_STORAGE_KEY = useMemo(() => makeStorageKey(namespace, "validated_table"), [namespace]);
  const CART_STORAGE_KEY = useMemo(() => makeStorageKey(namespace, "cart_items"), [namespace]);
  const SESSION_CONSUMED_KEY = useMemo(() => makeStorageKey(namespace, "session_consumed"), [namespace]);
  const SESSION_CLOSED_KEY = useMemo(() => makeStorageKey(namespace, "session_closed"), [namespace]);
  const DINING_STORAGE_KEY = useMemo(() => makeStorageKey(namespace, "dining_session"), [namespace]);

  const [pendingStoredTable] = useState<ValidatedTable | null>(() => {
    // One-shot migration from pre-namespace globals for the current restaurant.
    migrateLegacyStorage(namespace);
    return readStoredTable(
      makeStorageKey(namespace, "validated_table"),
      makeStorageKey(namespace, "dining_session"),
      makeStorageKey(namespace, "cart_items"),
      makeStorageKey(namespace, "session_consumed"),
      namespace,
    );
  });
  const [items, setItems] = useState<CartLine[]>(() => readStoredItems(makeStorageKey(namespace, "cart_items")));
  const [isCartOpen, setCartOpen] = useState(false);
  const [validatedTable, setValidatedTableState] = useState<ValidatedTable | null>(null);
  const [sessionHydrating, setSessionHydrating] = useState<boolean>(() => !!pendingStoredTable);
  const [sessionConsumed, setSessionConsumed] = useState<number>(() => {
    const t = pendingStoredTable;
    const s = readStoredConsumption(makeStorageKey(namespace, "session_consumed"));
    if (t && s && s.token === t.token) return s.total;
    return 0;
  });
  const [sessionOrderCount, setSessionOrderCount] = useState<number>(() => {
    const t = pendingStoredTable;
    const s = readStoredConsumption(makeStorageKey(namespace, "session_consumed"));
    if (t && s && s.token === t.token) return s.count;
    return 0;
  });
  const [sessionClosed, setSessionClosed] = useState<boolean>(() => {
    // Never persist the closed flag — a closed table must not block any
    // future visitor or QR scan on this device. The flag only lives for the
    // lifetime of the current tab session in memory.
    return false;
  });
  const [showClosedModal, setShowClosedModal] = useState<boolean>(() => {
    return false;
  });

  // Defensive: purge any legacy SESSION_CLOSED_KEY left behind by older
  // builds so it cannot block a fresh QR scan after refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.sessionStorage.removeItem(SESSION_CLOSED_KEY); } catch {}
  }, []);

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
    if (table && (
      !isValidTableNumber(table.number) ||
      !table.token?.trim() ||
      !table.sessionId?.trim() ||
      !table.restaurantId?.trim() ||
      !table.diningSessionId?.trim() ||
      !table.customerToken?.trim()
    )) {
      console.warn("CART_CTX_REJECTED_INVALID_TABLE", table);
      return;
    }
    setValidatedTableState(table);
    if (typeof window === "undefined") return;
    try {
      if (table) {
        window.localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(table));
        window.localStorage.setItem(DINING_STORAGE_KEY, JSON.stringify({
          dining_session_id: table.diningSessionId,
          customer_token: table.customerToken,
          restaurant_id: table.restaurantId,
          table_id: table.id,
          table_number: table.number,
          session_status: "active",
        }));
        console.log("VALIDATED_TABLE_STORAGE_WRITE", {
          key: TABLE_STORAGE_KEY,
          value: table,
          dining_session_id: table.diningSessionId,
        });
      } else {
        window.localStorage.removeItem(TABLE_STORAGE_KEY);
        window.localStorage.removeItem(DINING_STORAGE_KEY);
      }
    } catch {}
    // When the table changes (or is cleared), reset accumulated consumption
    // unless the same token is being re-applied (refresh restoration).
    const stored = readStoredConsumption(SESSION_CONSUMED_KEY);
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
    const traceId = newTraceId("terminate");
    traceLog(traceId, "STEP 9 — CartContext.terminateSession (THIS overwrites validatedTable→null)", {
      reason: "called by poller or revalidate",
      stack: new Error().stack?.split("\n").slice(1, 6).join("\n"),
      had_validated_table: !!validatedTable,
      had_items: items.length,
    });
    setValidatedTableState(null);
    setItems([]);
    setSessionConsumed(0);
    setSessionOrderCount(0);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(TABLE_STORAGE_KEY);
        window.localStorage.removeItem(DINING_STORAGE_KEY);
        window.localStorage.removeItem(CART_STORAGE_KEY);
        window.localStorage.removeItem(SESSION_CONSUMED_KEY);
        window.sessionStorage.removeItem(TABLE_STORAGE_KEY);
        window.sessionStorage.removeItem(SESSION_CLOSED_KEY);
      } catch {}
    }
    setSessionClosed(true);
    setShowClosedModal(true);
    // Per product spec: after FL confirms closure, reload automatically so
    // the device returns to the initial QR-scan state. Delay a few seconds
    // so the user sees the "Mesa Encerrada" notice first.
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        try {
          window.sessionStorage.removeItem(SESSION_CLOSED_KEY);
        } catch {}
        window.location.reload();
      }, 4000);
    }
  };

  const acknowledgeClosure = () => {
    setShowClosedModal(false);
    // Acknowledging the closure must fully unblock the app so the next QR
    // scan starts a brand new validation flow without any leftover guard.
    // We force a hard reload to guarantee no stale React/localStorage state
    // survives — the device returns to the initial QR-scan screen.
    setSessionClosed(false);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(SESSION_CLOSED_KEY);
        window.localStorage.removeItem(TABLE_STORAGE_KEY);
        window.localStorage.removeItem(DINING_STORAGE_KEY);
        window.localStorage.removeItem(CART_STORAGE_KEY);
        window.localStorage.removeItem(SESSION_CONSUMED_KEY);
      } catch {}
      window.location.reload();
    }
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
    if (!table?.token || !table.restaurantId || !table.diningSessionId || !table.customerToken) {
      terminateSession({ silent: true });
      return false;
    }
    try {
      const data = await svcCheckTableSession({
        restaurant_id: table.restaurantId,
        table_token: table.token ?? null,
        table_session_id: table.sessionId,
        table_number: table.number ?? null,
        dining_session_id: table.diningSessionId,
        customer_token: table.customerToken,
      });
      if (data.closed || !data.success) {
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

  // Unified scan→open→persist pipeline. Idempotent: safe to call multiple times
  // with the same token. Always uses the SAME setValidatedTable path so the
  // validatedTable lifecycle (state + localStorage + sessionConsumed reset)
  // stays identical to the cart-drawer flow.
  const validateAndOpenTable: CartCtx["validateAndOpenTable"] = async ({
    restaurant,
    table_number,
    table_token,
    restaurant_slug,
    customer_name,
    customer_phone,
  }) => {
    const number = (table_number || "").trim();
    const token = (table_token || "").trim();
    if (!isValidTableNumber(number) || !token) {
      console.warn("VALIDATE_AND_OPEN_TABLE_INVALID_INPUT", { number, token });
      return { success: false, message: "invalid_input" };
    }
    if (!restaurant?.id) {
      console.warn("VALIDATE_AND_OPEN_TABLE_MISSING_RESTAURANT");
      return { success: false, message: "missing_restaurant" };
    }
    if (sessionClosed) clearSessionClosed();

    const payload: OpenTableSessionPayload = {
      type: "open_table_session",
      restaurant_slug: (restaurant_slug || restaurant.slug || "").trim(),
      order_type: "table",
      service_mode: "mesa",
      table_number: number,
      table_token: token,
      customer_name: customer_name || undefined,
      customer_phone: customer_phone || undefined,
      opened_from: "qrcode_scan",
      opened_at: new Date().toISOString(),
    };

    try {
      const result = await openTableSession(restaurant, payload);
      console.log("VALIDATE_AND_OPEN_TABLE_RESULT", result);
      if (!result.success || result.closed || !result.session_id || !result.dining_session_id || !result.customer_token) {
        return {
          success: false,
          closed: !!result.closed,
          session_id: result.session_id ?? null,
          dining_session_id: result.dining_session_id ?? null,
          customer_token: result.customer_token ?? null,
          message: result.message,
        };
      }
      const tableData: ValidatedTable = {
        id: "flycontrol-table",
        number,
        token,
        sessionId: result.session_id,
        diningSessionId: result.dining_session_id,
        customerToken: result.customer_token,
        restaurantId: restaurant.id,
      };
      setValidatedTable(tableData);
      console.log("TABLE_VALIDATED_AND_PERSISTED", tableData);
      return {
        success: true,
        already_open: !!result.already_open,
        session_id: result.session_id,
        dining_session_id: result.dining_session_id,
        customer_token: result.customer_token,
      };
    } catch (err: any) {
      console.error("VALIDATE_AND_OPEN_TABLE_ERROR", err);
      return { success: false, message: err?.message || "open_failed" };
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
        const stored = readStoredConsumption(SESSION_CONSUMED_KEY);
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
      const pollTraceId = newTraceId("poll-ctx");
      const t0 = Date.now();
      traceLog(pollTraceId, "STEP 8a — CartContext poll tick START", {
        session_id: validatedTable.sessionId,
        table_number: validatedTable.number,
      });
      try {
        const data = await svcCheckTableSession({
          restaurant_id: validatedTable.restaurantId!,
          table_token: validatedTable.token ?? null,
          table_session_id: validatedTable.sessionId ?? null,
          table_number: validatedTable.number ?? null,
          dining_session_id: validatedTable.diningSessionId ?? null,
          customer_token: validatedTable.customerToken ?? null,
          traceId: pollTraceId,
        });
        if (cancelled) return;
        traceLog(pollTraceId, "STEP 8a — CartContext poll tick END", {
          elapsed_ms: Date.now() - t0,
          body: data.raw ?? data,
        });
        if (data.closed) {
          traceLog(pollTraceId, "STEP 9 — CartContext poll → terminateSession (will overwrite state)", data);
          terminateSession({ silent: true });
        }
      } catch (err) {
        traceWarn(pollTraceId, "CartContext poll error", err);
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
  }, [validatedTable?.token, validatedTable?.restaurantId, validatedTable?.diningSessionId]);

  // Realtime subscription: the AUTHORITATIVE closure signal. Filtered by the
  // exact session_id so a closure on a previous session on the same physical
  // table can never terminate the current one. Polling above remains as a
  // backup for missed events / offline gaps.
  useEffect(() => {
    const dsid = validatedTable?.diningSessionId;
    if (!dsid) return;
    const channel = supabase
      .channel(`dining-session-${dsid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "dining_sessions", filter: `id=eq.${dsid}` },
        (payload) => {
          const next = (payload.new ?? {}) as { status?: string | null; closed_at?: string | null };
          const status = (next.status ?? "").toString().trim().toLowerCase();
          // Regra estrita: apenas `status === 'active'` mantém a sessão viva.
          // Qualquer outro estado (incluindo `requested_close`) encerra
          // imediatamente a sessão do cliente.
          const stillActive = status === "active" && !next.closed_at;
          if (!stillActive) {
            const traceId = newTraceId("realtime");
            traceLog(traceId, "STEP 9 — Realtime UPDATE → terminateSession", { dining_session_id: dsid, next });
            terminateSession({ silent: true });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validatedTable?.diningSessionId]);

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
      validateAndOpenTable,
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