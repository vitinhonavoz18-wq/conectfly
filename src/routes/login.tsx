import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Loader2, Lock, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BrandLogo } from "@/components/admin/BrandLogo";
import { SESSION_KEY } from "@/components/AdminRouteGuard";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  beforeLoad: async ({ search, location }) => {
    if (typeof window === "undefined") return;
    
    const sessionV2 = localStorage.getItem(SESSION_KEY);
    const { data } = await supabase.auth.getSession();
    const isAdmin = data.session?.user.email === 'vitinhonavoz18@gmail.com';
    
    console.log(`[Login] Verificando acesso. Rota: ${location.pathname} | isAdminRoute: false | isPublicPizzeriaSlug: false | adminSessionValid: ${!!sessionV2 && isAdmin}`);

    if (sessionV2 === "true" && data.session && isAdmin) {
      console.log("[Login] Sessão V2 válida detectada. Redirecionando para o painel.");
      throw redirect({ to: search.redirect || "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    console.log("[Login] Tela carregada. Rota: /login | isAdminRoute: false | isPublicPizzeriaSlug: false");
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Informe a senha administrativa");
      return;
    }
    setBusy(true);
    try {
      console.log("Iniciando validação administrativa via Edge Function...");
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: { password }
      });

      if (error) {
        console.error("Erro na chamada da Edge Function:", error);
        throw new Error(error.message || "Erro de comunicação com o servidor.");
      }
      
      console.log("Resposta da Edge Function recebida:", data);

      if (data?.success && data?.session) {
        // Limpar sessões antigas (Regra 6 e 9)
        localStorage.removeItem("sitecreatorfly_admin_session");
        
        const { error: setSessionError } = await supabase.auth.setSession(data.session);
        if (setSessionError) throw setSessionError;
        
        // Criar nova sessão V2
        localStorage.setItem(SESSION_KEY, "true");
        console.log("[Login] Sessão sitecreatorfly_admin_session_v2 criada.");
        
        toast.success("Acesso autorizado. Bem-vindo, Admin.");
        navigate({ to: search.redirect || "/" });
      } else {
        const errorMessage = data?.message || data?.error || "Senha incorreta ou acesso negado.";
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error("Erro no login admin:", err);
      toast.error(err instanceof Error ? err.message : "Senha incorreta ou erro de conexão");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient gold/wood glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:repeating-linear-gradient(115deg,#DAA520_0,#DAA520_1px,transparent_1px,transparent_8px)]" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="relative inline-flex flex-col items-center justify-center px-10 py-6 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-primary/20 shadow-[0_30px_80px_-30px_oklch(0.62_0.16_48_/_0.45)]">
            <BrandLogo size="xl" />
            <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-primary/80 font-bold">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary/60" />
              <ChefHat className="h-3 w-3" />
              <span>Plataforma Privada</span>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary/60" />
            </div>
          </div>
          <h2 className="text-xl font-black mt-8 tracking-tight uppercase">Acesso Administrativo</h2>
          <p className="text-sm text-muted-foreground mt-2 italic">
            Área restrita para gestão da ConnectFly
          </p>
        </div>

        <div className="card-premium p-8 space-y-5 border-primary/10">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Senha Admin</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50 text-center text-2xl tracking-[0.5em]"
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn-premium w-full px-6 py-4 rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-[0.2em] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Acessar Painel
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-10 uppercase tracking-[0.2em]">
          ConnectFly v2.0 — Sistema de Uso Interno
        </p>
      </div>
    </div>
  );
}
