import { Info } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Aviso exibido apenas enquanto o Supabase não está configurado.
 * Some automaticamente assim que as variáveis de ambiente forem preenchidas.
 */
export function DemoModeBanner() {
  if (isSupabaseConfigured()) return null;

  return (
    <div className="bg-neon-500 text-ink-950">
      <p className="container-page flex items-center justify-center gap-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.12em]">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Modo demonstração — produtos fictícios. Configure o Supabase para usar o catálogo real.
      </p>
    </div>
  );
}
