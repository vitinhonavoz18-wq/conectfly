/**
 * ScrollManager — body scroll-lock + position preservation.
 *
 * Replaces ad-hoc `document.body.style.overflow = 'hidden'` calls scattered
 * across modal/drawer code. Tracks a lock counter so nested locks behave
 * correctly, and restores the previous scroll position when fully unlocked.
 */

let lockCount = 0;
let savedScrollY = 0;
let savedBodyStyles: { overflow: string; position: string; top: string; width: string } | null = null;

export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  lockCount += 1;

  if (lockCount === 1) {
    savedScrollY = window.scrollY;
    savedBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = "100%";
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    unlockScroll();
  };
}

function unlockScroll() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && savedBodyStyles) {
    document.body.style.overflow = savedBodyStyles.overflow;
    document.body.style.position = savedBodyStyles.position;
    document.body.style.top = savedBodyStyles.top;
    document.body.style.width = savedBodyStyles.width;
    window.scrollTo(0, savedScrollY);
    savedBodyStyles = null;
  }
}

export function scrollToTop(behavior: ScrollBehavior = "smooth") {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior });
}