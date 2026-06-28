/**
 * ViewportManager — keeps a stable viewport height variable.
 *
 * iOS Safari and Android keyboards collapse/expand `100vh` unpredictably.
 * We expose `--app-vh` (1% of the visual viewport height) so layouts can
 * use `calc(var(--app-vh) * 100)` instead of `100vh` and stay stable when
 * the soft keyboard opens or floating UI appears.
 */

let installed = false;
let cleanup: (() => void) | null = null;

function applyVh() {
  if (typeof window === "undefined") return;
  const vv = window.visualViewport;
  const h = vv?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-vh", `${h * 0.01}px`);
  document.documentElement.style.setProperty("--app-vh-full", `${h}px`);
}

export function installViewport() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  applyVh();
  const onResize = () => applyVh();
  window.addEventListener("resize", onResize, { passive: true });
  window.visualViewport?.addEventListener("resize", onResize, { passive: true });
  window.visualViewport?.addEventListener("scroll", onResize, { passive: true });
  cleanup = () => {
    window.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("scroll", onResize);
  };
}

export function uninstallViewport() {
  cleanup?.();
  cleanup = null;
  installed = false;
}