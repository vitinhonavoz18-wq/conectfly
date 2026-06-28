/**
 * AccessibilityManager — enforces minimum touch target and respects
 * reduced-motion. Currently exposes constants + a helper to attach the
 * standard A11y attributes to a floating action.
 */

export const MIN_TOUCH_TARGET_PX = 48;

export function a11yButtonProps(label: string) {
  return {
    "aria-label": label,
    role: "button" as const,
    tabIndex: 0,
    style: { minWidth: MIN_TOUCH_TARGET_PX, minHeight: MIN_TOUCH_TARGET_PX },
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}