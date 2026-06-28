/**
 * FloatingManager — global registry for floating action buttons.
 *
 * Templates never position floating UI manually. They register their slot
 * (`cart`, `back`, `whatsapp`, `qr`, `close-table`) and read the computed
 * `bottom` offset for that slot. The manager stacks slots in priority
 * order, automatically respecting the safe-area inset.
 */

import { useSyncExternalStore } from "react";

export type FloatingSlot =
  | "cart"
  | "back"
  | "whatsapp"
  | "qr"
  | "close-table"
  | "custom";

interface SlotState {
  slot: FloatingSlot;
  height: number; // px reserved by the button
}

const STACK_ORDER: FloatingSlot[] = ["cart", "qr", "whatsapp", "close-table", "back", "custom"];
const GAP = 12;

const slots = new Map<string, SlotState>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function registerFloating(id: string, slot: FloatingSlot, height = 56) {
  slots.set(id, { slot, height });
  emit();
  return () => {
    slots.delete(id);
    emit();
  };
}

function computeOffset(target: FloatingSlot): number {
  let offset = 0;
  for (const slot of STACK_ORDER) {
    if (slot === target) break;
    for (const state of slots.values()) {
      if (state.slot === slot) {
        offset += state.height + GAP;
        break;
      }
    }
  }
  return offset;
}

/**
 * CSS-compatible `bottom` value for a slot. Pass to inline style:
 *   style={{ bottom: useFloatingOffset("cart") }}
 */
export function useFloatingOffset(slot: FloatingSlot): string {
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };
  const getSnapshot = () => `calc(env(safe-area-inset-bottom, 0px) + ${computeOffset(slot) + 16}px)`;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}