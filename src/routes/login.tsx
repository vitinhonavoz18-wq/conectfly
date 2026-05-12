import { createFileRoute, Link, useNavigate, useSearch, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, Rocket, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: search.redirect || "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha email e senha");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        
        if (data.session) {
          toast.success("Conta criada com sucesso! Bem-vindo.");
          navigate({ to: search.redirect || "/" });
        } else {
          toast.success("Conta criada! Verifique seu email para confirmar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo!");
        navigate({ to: search.redirect || "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de autenticação");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + (search.redirect || "/"),
      });
      if (result.error) {
        toast.error("Falha no login com Google");
        setBusy(false);
        return;
      }
      if (result.redirected) return; // browser is redirecting
      toast.success("Bem-vindo!");
      navigate({ to: search.redirect || "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-bronze items-center justify-center shadow-glow mb-4">
            <Rocket className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">SiteCreatorFly</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Acesse sua conta" : "Crie sua conta"}
          </p>
        </div>

        <div className="card-premium p-8 space-y-5">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full px-5 py-3 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-3 hover:bg-white/90 transition-all disabled:opacity-50 shadow-lg"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground tracking-widest">ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50"
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50"
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn-premium w-full px-6 py-4 rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-[0.2em] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : mode === "login" ? (
                <>
                  <LogIn className="h-4 w-4" /> Entrar
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Criar Conta
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
            className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/" className="hover:text-primary">← Voltar ao site</Link>
        </p>
      </div>
    </div>
  );
}