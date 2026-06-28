/**
 * Debug instrumentation for the "Fechar Mesa" (Close Table) flow.
 *
 * INSTRUMENTATION ONLY — this module MUST NOT change behavior.
 *
 * Every customer click generates a unique `traceId` that is propagated:
 *   - through the browser console (grouped logs per phase)
 *   - through the HTTP request via the `x-debug-trace-id` header
 *   - into the backend handler logs (echoed back with the same id)
 *
 * Background pollers (CartContext + SiteCartDrawer) emit their own
 * `pollTraceId`s tagged with their source so the timing/order of polls vs
 * the click flow is fully reconstructable from the console.
 *
 * Toggle: enabled by default in dev; in production it can be force-enabled
 * by setting `localStorage.setItem("sf:debug-close-flow", "1")` and reloaded.
 */

const STORAGE_KEY = "sf:debug-close-flow";

export function isCloseDebugEnabled(): boolean {
  if (typeof window === "undefined") return true; // server side: always log
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {}
  // Default ON — instrumentation is intentionally verbose while we
  // diagnose the close flow; flip the flag off to silence.
  return true;
}

export function newTraceId(prefix = "close"): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${t}-${r}`;
}

function ts() {
  return new Date().toISOString();
}

export function traceGroup(traceId: string, label: string) {
  if (!isCloseDebugEnabled()) return;
  try {
    // Use collapsed groups so the console stays scannable.
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c[CLOSE-FLOW ${traceId}]%c ${label} @ ${ts()}`, "color:#e11d48;font-weight:bold", "color:inherit");
  } catch {}
}

export function traceLog(traceId: string, label: string, data?: unknown) {
  if (!isCloseDebugEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.log(`[CLOSE-FLOW ${traceId}] ${ts()} — ${label}`, data ?? "");
  } catch {}
}

export function traceWarn(traceId: string, label: string, data?: unknown) {
  if (!isCloseDebugEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.warn(`[CLOSE-FLOW ${traceId}] ${ts()} — ${label}`, data ?? "");
  } catch {}
}

export function traceError(traceId: string, label: string, data?: unknown) {
  if (!isCloseDebugEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.error(`[CLOSE-FLOW ${traceId}] ${ts()} — ${label}`, data ?? "");
  } catch {}
}

export function traceGroupEnd() {
  if (!isCloseDebugEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.groupEnd();
  } catch {}
}

export const TRACE_HEADER = "x-debug-trace-id";