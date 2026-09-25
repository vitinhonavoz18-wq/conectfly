import { Info } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Aviso exibido apenas enquanto o Supabase não está configurado.
 * Some automaticamente assim que as variáveis de ambiente forem preenchidas.
 * Discreto de propósito: informa sem dominar a página.
 */
export function DemoModeBanner() {
  if (isSupabaseConfigured()) return null;

  return (
    <div className="border-b border-white/6 bg-ink-950">
      <p className="container-page flex items-center justify-center gap-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-smoke-400">
        <Info className="h-3.5 w-3.5 shrink-0 text-neon-500" aria-hidden />
        <span>
          Modo demonstração — produtos fictícios.
          <span className="hidden sm:inline"> Configure o Supabase para usar o catálogo real.</span>
        </span>
      </p>
    </div>
  );
}
