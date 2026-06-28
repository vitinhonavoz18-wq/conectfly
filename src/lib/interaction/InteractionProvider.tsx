import { useEffect, type ReactNode } from "react";
import { installViewport } from "./ViewportManager";
import { installSafeArea } from "./SafeAreaManager";

/**
 * Mounts ONCE at the platform level (see TemplateRenderer). Installs the
 * always-on managers (viewport height + safe-area inset variables). All
 * other helpers in the interaction layer are pull-based and don't need
 * a provider to be useful.
 */
export function InteractionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    installViewport();
    installSafeArea();
  }, []);
  return <>{children}</>;
}