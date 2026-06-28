/**
 * MobileDetection — lightweight, SSR-safe device/runtime detection.
 *
 * Part of the Universal Interaction Layer (see src/lib/interaction/index.ts).
 * No template should hand-roll UA parsing or "isMobile" checks; consume
 * these helpers instead so behavior stays consistent across the platform.
 */

export interface DeviceInfo {
  isTouch: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  hasHover: boolean;
  hasFinePointer: boolean;
  prefersReducedMotion: boolean;
}

const FALLBACK: DeviceInfo = {
  isTouch: false,
  isIOS: false,
  isAndroid: false,
  isSafari: false,
  isStandalone: false,
  hasHover: true,
  hasFinePointer: true,
  prefersReducedMotion: false,
};

let cached: DeviceInfo | null = null;

export function detectDevice(): DeviceInfo {
  if (typeof window === "undefined") return FALLBACK;
  if (cached) return cached;

  const ua = window.navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && (window.navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
  const isAndroid = /Android/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isTouch =
    "ontouchstart" in window ||
    (window.navigator.maxTouchPoints ?? 0) > 0;

  const matches = (q: string) =>
    typeof window.matchMedia === "function" ? window.matchMedia(q).matches : false;

  cached = {
    isTouch,
    isIOS,
    isAndroid,
    isSafari,
    isStandalone:
      matches("(display-mode: standalone)") ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    hasHover: matches("(hover: hover)"),
    hasFinePointer: matches("(pointer: fine)"),
    prefersReducedMotion: matches("(prefers-reduced-motion: reduce)"),
  };
  return cached;
}

export function isTouchDevice(): boolean {
  return detectDevice().isTouch;
}