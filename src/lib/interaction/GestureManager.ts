/**
 * GestureManager — unified tap / long-press / swipe recognizer.
 *
 * Built on Pointer Events (see PointerManager) so a single subscription
 * works for mouse, touch and pen without duplicate listeners.
 */

import { bindPointer, isPrimaryPointer } from "./PointerManager";

export interface GestureCallbacks {
  onTap?: (event: PointerEvent) => void;
  onLongPress?: (event: PointerEvent) => void;
  onSwipe?: (direction: "left" | "right" | "up" | "down", event: PointerEvent) => void;
}

export interface GestureOptions {
  longPressMs?: number;
  swipeThresholdPx?: number;
  tapSlopPx?: number;
}

export function attachGestures(
  target: HTMLElement,
  cb: GestureCallbacks,
  opts: GestureOptions = {},
): () => void {
  const longPressMs = opts.longPressMs ?? 500;
  const swipeThreshold = opts.swipeThresholdPx ?? 40;
  const tapSlop = opts.tapSlopPx ?? 8;

  let startX = 0;
  let startY = 0;
  let startedAt = 0;
  let longPressTimer: number | null = null;
  let cancelled = false;

  const clearLong = () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const offDown = bindPointer(target, "pointerdown", (e) => {
    if (!isPrimaryPointer(e)) return;
    cancelled = false;
    startX = e.clientX;
    startY = e.clientY;
    startedAt = performance.now();
    if (cb.onLongPress) {
      longPressTimer = window.setTimeout(() => {
        cancelled = true;
        cb.onLongPress?.(e);
      }, longPressMs);
    }
  });

  const offMove = bindPointer(target, "pointermove", (e) => {
    if (Math.abs(e.clientX - startX) > tapSlop || Math.abs(e.clientY - startY) > tapSlop) {
      clearLong();
    }
  });

  const offUp = bindPointer(target, "pointerup", (e) => {
    clearLong();
    if (cancelled) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > swipeThreshold || absY > swipeThreshold) {
      if (cb.onSwipe) {
        if (absX > absY) cb.onSwipe(dx > 0 ? "right" : "left", e);
        else cb.onSwipe(dy > 0 ? "down" : "up", e);
      }
      return;
    }
    if (absX <= tapSlop && absY <= tapSlop) {
      cb.onTap?.(e);
    }
  });

  const offCancel = bindPointer(target, "pointercancel", () => {
    cancelled = true;
    clearLong();
  });

  return () => {
    clearLong();
    offDown();
    offMove();
    offUp();
    offCancel();
  };
}