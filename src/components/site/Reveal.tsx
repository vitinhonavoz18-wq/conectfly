import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

type Variant = "fade-up" | "fade" | "zoom" | "slide-left" | "slide-right";

interface RevealProps {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  duration?: number;
  className?: string;
  as?: ElementType;
  once?: boolean;
  threshold?: number;
}

/**
 * Scroll-driven reveal wrapper using IntersectionObserver.
 * Honors prefers-reduced-motion.
 */
export function Reveal({
  children,
  variant = "fade-up",
  delay = 0,
  duration = 700,
  className = "",
  as: Tag = "div",
  once = true,
  threshold = 0.15,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            if (once) obs.unobserve(e.target);
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -10% 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [once, threshold]);

  const initial: Record<Variant, string> = {
    "fade-up": "translate3d(0, 32px, 0)",
    fade: "none",
    zoom: "scale(0.94)",
    "slide-left": "translate3d(-40px, 0, 0)",
    "slide-right": "translate3d(40px, 0, 0)",
  };

  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : initial[variant],
    transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
    willChange: "opacity, transform",
  };

  const Component = Tag as any;
  return (
    <Component ref={ref as any} style={style} className={className}>
      {children}
    </Component>
  );
}

/**
 * Top-of-page horizontal scroll progress bar.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const update = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop || document.body.scrollTop;
      const max = (h.scrollHeight - h.clientHeight) || 1;
      setProgress(Math.min(100, Math.max(0, (scrolled / max) * 100)));
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-[hsl(var(--site-primary))] transition-[width] duration-75 ease-out shadow-[0_0_8px_hsl(var(--site-primary))]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/**
 * Hook that returns a scroll-linked parallax translateY in px for a target ref.
 */
export function useParallax(speed = 0.2) {
  const ref = useRef<HTMLElement | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    const update = () => {
      const node = ref.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - window.innerHeight / 2;
        setOffset(-center * speed);
      }
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed]);
  return { ref, offset };
}

/**
 * Scroll-driven per-section progress.
 *
 * Computes a continuous progress value (0 → 1) based on the section's position
 * relative to the viewport. The progress is exposed via CSS custom properties
 * on the section element, so any descendant can synchronize transforms,
 * opacity, blur, color, etc. without extra JS.
 *
 * Exposed CSS variables (set on the section root):
 *   --section-progress          raw 0 → 1 across the full enter→leave window
 *   --section-progress-in       0 → 1 only during the enter phase (bottom→center)
 *   --section-progress-out      0 → 1 only during the leave phase (center→top)
 *   --section-progress-center   1 at center of viewport, 0 at edges (bell curve)
 *
 * Honors prefers-reduced-motion by locking values to a static "in view" state.
 */
export function useSectionProgress<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      node.style.setProperty("--section-progress", "0.5");
      node.style.setProperty("--section-progress-in", "1");
      node.style.setProperty("--section-progress-out", "0");
      node.style.setProperty("--section-progress-center", "1");
      return;
    }
    let raf = 0;
    let visible = false;
    const update = () => {
      raf = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Window: section bottom enters viewport (top = vh) until top leaves viewport (bottom = 0)
      const total = rect.height + vh;
      const traveled = vh - rect.top;
      const raw = Math.min(1, Math.max(0, traveled / total));
      const inPhase = Math.min(1, Math.max(0, (vh - rect.top) / vh));
      const outPhase = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
      // Bell curve peaking when section center is at viewport center
      const sectionCenter = rect.top + rect.height / 2;
      const dist = Math.abs(sectionCenter - vh / 2) / (vh / 2 + rect.height / 2);
      const center = Math.max(0, 1 - dist);
      node.style.setProperty("--section-progress", raw.toFixed(4));
      node.style.setProperty("--section-progress-in", inPhase.toFixed(4));
      node.style.setProperty("--section-progress-out", outPhase.toFixed(4));
      node.style.setProperty("--section-progress-center", center.toFixed(4));
    };
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        visible = e.isIntersecting;
        if (visible) schedule();
      });
    }, { rootMargin: "20% 0px 20% 0px" });
    io.observe(node);
    const onScroll = () => { if (visible) schedule(); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}

interface SectionScrollProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  id?: string;
  style?: CSSProperties;
}

/**
 * Wrapper that exposes per-section scroll progress as CSS variables
 * (`--section-progress`, `--section-progress-in`, `--section-progress-out`,
 * `--section-progress-center`) so children can drive synchronized animations
 * via CSS without additional JS.
 */
export function SectionScroll({ children, className = "", as: Tag = "section", id, style }: SectionScrollProps) {
  const ref = useSectionProgress<HTMLElement>();
  const Component = Tag as any;
  return (
    <Component ref={ref as any} id={id} className={`site-section-scroll ${className}`} style={style}>
      {children}
    </Component>
  );
}