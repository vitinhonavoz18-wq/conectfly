/**
 * Unified service layer for ALL table-session HTTP interactions.
 *
 * This module is the single source of truth for every table-session API call
 * the customer-facing site performs. No component, hook, or helper should
 * issue a `fetch` to a `/api/public/*-table-*` endpoint directly — import
 * the corresponding function from this file instead.
 *
 * Exposes exactly three operations:
 *   - checkTableSession()  → GET-style status poll (non-mutating)
 *   - requestTableClose()  → customer asks the operator to close the table
 *   - closeTableSession()  → mirror a confirmed FlyControl closure into the
 *                            local backend (used by webhooks/tests/admin)
 *
 * Centralizing here guarantees consistent baseURL, headers, JSON handling,
 * and error semantics across the entire application.
 */

const BASE_URL = "/api/public";

const DEFAULT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export interface CheckTableSessionParams {
  restaurant_id: string;
  table_token?: string | null;
  table_session_id?: string | null;
  table_number?: string | null;
  /** Authoritative dining session identifier. Preferred over table_session_id. */
  dining_session_id?: string | null;
  /** Customer's private token bound to this dining session. */
  customer_token?: string | null;
  /** Optional debug trace id; echoed back by the server when supplied. */
  traceId?: string;
}

export interface CheckTableSessionResult {
  success: boolean;
  closed: boolean;
  status?: string | null;
  unavailable?: boolean;
  raw?: any;
}

export interface RequestTableCloseParams {
  restaurant_id: string;
  table_number: string | null;
  table_token: string | null;
  table_session_id?: string | null;
  dining_session_id?: string | null;
  customer_token?: string | null;
  customer_name?: string | null;
  /** Identifier of the local table row when known. */
  table_id?: string | null;
  /** Origin of the request. Defaults to `customer_ui`. */
  source?: string;
  traceId?: string;
}

export interface RequestTableCloseResult {
  success: boolean;
  duplicate?: boolean;
  status: number;
  message?: string;
  raw?: any;
}

export interface CloseTableSessionParams {
  restaurant_id: string;
  table_session_id?: string | null;
  dining_session_id?: string | null;
  customer_token?: string | null;
  table_token?: string | null;
  table_number?: string | null;
  final_total?: number | null;
  traceId?: string;
}

export interface CloseTableSessionResult {
  success: boolean;
  status: number;
  message?: string;
  raw?: any;
}

const TRACE_HEADER = "x-debug-trace-id";

function buildHeaders(traceId?: string): HeadersInit {
  if (!traceId) return DEFAULT_HEADERS;
  return { ...DEFAULT_HEADERS, [TRACE_HEADER]: traceId };
}

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Non-mutating status check. Returns `{ closed: true }` when the server
 * reports the table session as closed/finalized. The only call site allowed
 * to drive the centralized polling loop in CartContext.
 */
export async function checkTableSession(
  params: CheckTableSessionParams,
): Promise<CheckTableSessionResult> {
  const { traceId, ...body } = params;
  try {
    const res = await fetch(`${BASE_URL}/check-table-session`, {
      method: "POST",
      headers: buildHeaders(traceId),
      body: JSON.stringify({
        restaurant_id: body.restaurant_id,
        table_token: body.table_token ?? null,
        table_session_id: body.table_session_id ?? null,
        table_number: body.table_number ?? null,
        dining_session_id: body.dining_session_id ?? null,
        customer_token: body.customer_token ?? null,
      }),
    });
    const data = await readJson(res);
    return {
      success: !!data?.success,
      closed: !!data?.closed,
      status: data?.status ?? null,
      unavailable: !!data?.unavailable,
      raw: data,
    };
  } catch (err: any) {
    console.warn("[tableSessionService] checkTableSession network error", err?.message);
    return { success: false, closed: false };
  }
}

/**
 * Customer-initiated request to close the table. The Digital Menu NEVER
 * closes the table itself — this only notifies the operator via FlyControl.
 */
export async function requestTableClose(
  params: RequestTableCloseParams,
): Promise<RequestTableCloseResult> {
  const { traceId, ...body } = params;
  try {
    const res = await fetch(`${BASE_URL}/table-close-request`, {
      method: "POST",
      headers: buildHeaders(traceId),
      body: JSON.stringify({
        restaurant_id: body.restaurant_id,
        table_number: body.table_number,
        table_token: body.table_token,
        table_session_id: body.table_session_id ?? null,
        dining_session_id: body.dining_session_id ?? null,
        customer_token: body.customer_token ?? null,
        customer_name: body.customer_name ?? null,
        table_id: body.table_id ?? null,
        source: body.source ?? "customer_ui",
        timestamp: new Date().toISOString(),
      }),
    });
    const data = await readJson(res);
    return {
      success: res.ok && data?.success !== false,
      duplicate: !!data?.duplicate,
      status: res.status,
      message: data?.error || data?.message,
      raw: data,
    };
  } catch (err: any) {
    console.warn("[tableSessionService] requestTableClose network error", err?.message);
    return {
      success: false,
      status: 0,
      message: err?.message || "network_error",
    };
  }
}

/**
 * Mirrors a confirmed FlyControl closure into the local backend. The
 * customer client should not call this directly — it exists so webhook
 * receivers, admin tools, and tests have a single, typed entry point.
 */
export async function closeTableSession(
  params: CloseTableSessionParams,
): Promise<CloseTableSessionResult> {
  const { traceId, ...body } = params;
  try {
    const res = await fetch(`${BASE_URL}/flycontrol-table-closed`, {
      method: "POST",
      headers: buildHeaders(traceId),
      body: JSON.stringify({
        restaurant_id: body.restaurant_id,
        table_session_id: body.table_session_id ?? null,
        dining_session_id: body.dining_session_id ?? null,
        customer_token: body.customer_token ?? null,
        table_token: body.table_token ?? null,
        table_number: body.table_number ?? null,
        final_total: body.final_total ?? null,
      }),
    });
    const data = await readJson(res);
    return {
      success: res.ok && data?.success !== false,
      status: res.status,
      message: data?.error || data?.message,
      raw: data,
    };
  } catch (err: any) {
    console.warn("[tableSessionService] closeTableSession network error", err?.message);
    return { success: false, status: 0, message: err?.message || "network_error" };
  }
}