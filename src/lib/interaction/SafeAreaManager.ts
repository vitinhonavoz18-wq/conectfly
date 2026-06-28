/**
 * SafeAreaManager — writes safe-area inset values to CSS variables so
 * any component can position itself with `var(--safe-bottom)` etc.
 * Modern iOS/Android already expose `env(safe-area-inset-*)`, but we
 * also project them as numeric `--safe-*` values for JS-driven layouts.
 */

let installed = false;

export function installSafeArea() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  // Make sure the meta viewport opts into safe-area insets.
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta && !/viewport-fit/.test(meta.getAttribute("content") || "")) {
    meta.setAttribute(
      "content",
      `${meta.getAttribute("content")}, viewport-fit=cover`,
    );
  }

  const root = document.documentElement;
  root.style.setProperty("--safe-top", "env(safe-area-inset-top, 0px)");
  root.style.setProperty("--safe-right", "env(safe-area-inset-right, 0px)");
  root.style.setProperty("--safe-bottom", "env(safe-area-inset-bottom, 0px)");
  root.style.setProperty("--safe-left", "env(safe-area-inset-left, 0px)");
}