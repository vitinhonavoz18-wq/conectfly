/**
 * Quem está logado no ZÉ CARRETO, do lado da tela.
 *
 * Enquanto carrega devolve `loading`. Se não houver ninguém logado e a
 * página exigir login, manda para a tela de entrada — sem piscar conteúdo
 * de outra pessoa.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface ZcSessionState {
  session: Session | null;
  loading: boolean;
}

export function useZcSession(options: { required?: boolean } = {}): ZcSessionState {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (options.required && !next) navigate({ to: "/zecarreto/entrar" });
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (options.required && !data.session) navigate({ to: "/zecarreto/entrar" });
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.required]);

  return { session, loading };
}
