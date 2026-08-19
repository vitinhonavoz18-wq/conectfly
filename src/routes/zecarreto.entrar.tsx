import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";

export const Route = createFileRoute("/zecarreto/entrar")({ component: EntrarPage });

type Mode = "entrar" | "criar" | "recuperar";

function EntrarPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [termsUrl, setTermsUrl] = useState("");

  useEffect(() => {
    // Já está logado? Vai direto para dentro.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/zecarreto" });
    });
    zcApi<{ social_providers: string[]; terms_url: string }>("/auth/config")
      .then((config) => {
        setProviders(config.social_providers ?? []);
        setTermsUrl(config.terms_url ?? "");
      })
      .catch(() => undefined);
  }, [navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "recuperar") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/zecarreto/entrar`,
        });
        if (error) throw error;
        toast.success("Enviamos um e-mail com o link para criar uma senha nova.");
        setMode("entrar");
        return;
      }

      if (mode === "criar") {
        if (password.length < 8) {
          toast.error("A senha precisa ter pelo menos 8 caracteres.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme o e-mail, se pedirmos, e entre.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/zecarreto" });
    } catch (error) {
      toast.error(traduzErroDeLogin(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSocial(provider: string) {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as "google" | "apple",
        options: { redirectTo: `${window.location.origin}/zecarreto` },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(zcErrorMessage(error));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400">
            <Truck className="h-7 w-7 text-neutral-900" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">ZÉ CARRETO</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Carreto, mudança e entrega quando você precisar.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          {mode === "criar" && (
            <div className="space-y-1.5">
              <Label htmlFor="nome">Seu nome</Label>
              <Input
                id="nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Maria Souza"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              required
            />
          </div>

          {mode !== "recuperar" && (
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "criar" ? "new-password" : "current-password"}
                required
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "criar"
              ? "Criar minha conta"
              : mode === "recuperar"
                ? "Enviar link"
                : "Entrar"}
          </Button>

          {providers.length > 0 && mode !== "recuperar" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="h-px flex-1 bg-neutral-200" />
                ou
                <span className="h-px flex-1 bg-neutral-200" />
              </div>
              {providers.includes("google") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSocial("google")}
                >
                  Continuar com Google
                </Button>
              )}
              {providers.includes("apple") && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSocial("apple")}
                >
                  Continuar com Apple
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2 text-sm">
            {mode !== "entrar" && (
              <button
                type="button"
                className="text-neutral-600 underline"
                onClick={() => setMode("entrar")}
              >
                Já tenho conta
              </button>
            )}
            {mode !== "criar" && (
              <button
                type="button"
                className="text-neutral-600 underline"
                onClick={() => setMode("criar")}
              >
                Criar conta
              </button>
            )}
            {mode !== "recuperar" && (
              <button
                type="button"
                className="text-neutral-600 underline"
                onClick={() => setMode("recuperar")}
              >
                Esqueci minha senha
              </button>
            )}
          </div>
        </form>

        {termsUrl && (
          <p className="mt-4 text-center text-xs text-neutral-500">
            Ao continuar você concorda com os{" "}
            <a href={termsUrl} target="_blank" rel="noreferrer" className="underline">
              termos de uso
            </a>
            .
          </p>
        )}
        <p className="mt-6 text-center text-xs text-neutral-400">
          <Link to="/zecarreto">Voltar</Link>
        </p>
      </div>
    </div>
  );
}

/** O Supabase responde em inglês; aqui a mensagem vira português. */
function traduzErroDeLogin(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha não conferem.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar.";
  if (/user already registered/i.test(message)) {
    return "Este e-mail já tem conta. Entre ou recupere a senha.";
  }
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Aguarde um minuto.";
  if (/password/i.test(message) && /short|least/i.test(message)) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }
  return zcErrorMessage(error);
}
