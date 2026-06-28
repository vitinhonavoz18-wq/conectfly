/**
 * PointerManager — normalized pointer-event subscription helpers.
 *
 * Standardizes on Pointer Events (pointerdown/up/move/cancel) instead of
 * mixing mouse + touch listeners. All managers in this folder use this
 * helper so we never register both `click` + `touchend` for the same
 * action (the classic "double-fire" bug on hybrid devices).
 */

export type PointerHandler = (event: PointerEvent) => void;

export interface PointerBindOptions {
  capture?: boolean;
  passive?: boolean;
}

export function bindPointer(
  target: EventTarget,
  type: "pointerdown" | "pointerup" | "pointermove" | "pointercancel",
  handler: PointerHandler,
  opts: PointerBindOptions = {},
): () => void {
  const listener = handler as EventListener;
  target.addEventListener(type, listener, {
    capture: opts.capture ?? false,
    passive: opts.passive ?? true,
  });
  return () => target.removeEventListener(type, listener, opts.capture ?? false);
}

/**
 * Returns true when the pointer event came from a primary touch/mouse
 * interaction (filters out secondary mouse buttons, pen erasers, etc).
 */
export function isPrimaryPointer(event: PointerEvent): boolean {
  if (event.pointerType === "mouse") return event.button === 0;
  return event.isPrimary !== false;
}