import { createFileRoute, Link, useNavigate, useSearch, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, LogIn, UserPlus, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { BrandLogo } from "@/components/admin/BrandLogo";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    
    // Se estiver em um subdomínio, não redireciona se já estiver logado (deixa ver o cardápio)
    // Mas se quiser logar, o login deve funcionar no subdomínio também.
    // No entanto, para evitar o redirect para "/", vamos verificar o subdomínio.
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const subdomain = getSubdomain();
      if (subdomain) {
        // Se estiver logado em um subdomínio, apenas redireciona para a home do subdomínio
        // que já vai mostrar o site público através do Dashboard
        throw redirect({ to: "/" });
      }
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
              <span>Plataforma Premium</span>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary/60" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-5 italic">
            {mode === "login" ? "Bem-vindo de volta ao seu estúdio gastronômico" : "Crie sua conta e comece a servir"}
          </p>
        </div>

        <div className="card-premium p-8 space-y-5 border-primary/10">

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