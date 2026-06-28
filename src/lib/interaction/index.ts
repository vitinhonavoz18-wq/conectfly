/**
 * Universal Interaction Layer.
 *
 * Single source of truth for pointer, gesture, scroll, floating, viewport,
 * safe-area, mobile detection and accessibility behavior. Every template
 * (Black, White, Pizza, Burger, BarPrime, future) consumes this layer
 * instead of implementing its own touch / mobile logic.
 *
 * Wiring:
 *   - `<InteractionProvider>` mounts ONCE at the platform level
 *     (TemplateRenderer) and installs viewport + safe-area observers.
 *   - Components import the specific helper they need:
 *       guard / shouldFire     → DoubleTapGuard
 *       attachGestures         → GestureManager
 *       bindPointer            → PointerManager
 *       lockScroll / scrollToTop → ScrollManager
 *       useFloatingOffset / registerFloating → FloatingManager
 *       detectDevice / isTouchDevice         → MobileDetection
 *       a11yButtonProps        → AccessibilityManager
 */

export * from "./PointerManager";
export * from "./GestureManager";
export * from "./DoubleTapGuard";
export * from "./ScrollManager";
export * from "./FloatingManager";
export * from "./SafeAreaManager";
export * from "./ViewportManager";
export * from "./MobileDetection";
export * from "./AccessibilityManager";
export { InteractionProvider } from "./InteractionProvider";