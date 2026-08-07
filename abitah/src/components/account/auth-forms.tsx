"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validations";
import { formatPhone, onlyDigits } from "@/lib/utils";
import { absoluteUrl } from "@/lib/utils";

function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-card border border-ink-700 bg-ink-900 p-6 sm:p-8">
      <h2 className="text-lg font-extrabold uppercase tracking-wide text-white">{title}</h2>
      <p className="mt-2 text-sm text-smoke-300">{subtitle}</p>
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 border-t border-ink-700 pt-5 text-sm">{footer}</div> : null}
    </div>
  );
}

export function SignInForm() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const params = useSearchParams();
  const { notify } = useToast();
  const redirect = params.get("redirect") ?? "/conta/perfil";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof signInSchema>) {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      notify("E-mail ou senha incorretos.", "error");
      return;
    }
    notify("Bem-vindo de volta!");
    router.push(redirect);
    router.refresh();
  }

  return (
    <AuthCard
      title="Entrar"
      subtitle="Acesse sua conta para acompanhar pedidos e favoritos."
      footer={
        <p className="text-smoke-300">
          Ainda não tem conta?{" "}
          <Link href="/conta/cadastro" className="font-semibold text-neon-400 hover:underline">
            Criar cadastro
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="E-mail" htmlFor="login-email" required error={errors.email?.message}>
          <Input id="login-email" type="email" autoComplete="email" {...register("email")} />
        </Field>

        <Field label="Senha" htmlFor="login-password" required error={errors.password?.message}>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
        </Field>

        <Link
          href="/conta/recuperar-senha"
          className="block text-xs text-smoke-400 hover:text-neon-400"
        >
          Esqueci minha senha
        </Link>

        <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </AuthCard>
  );
}

export function SignUpForm() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const { notify } = useToast();
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false as unknown as true,
    },
  });

  async function onSubmit(values: z.input<typeof signUpSchema>) {
    if (!supabase) return;
    const { error } = await supabase.auth.signUp({
      email: String(values.email),
      password: String(values.password),
      options: {
        data: {
          full_name: values.fullName,
          phone: onlyDigits(String(values.phone)),
        },
        emailRedirectTo: absoluteUrl("/conta/entrar"),
      },
    });

    if (error) {
      notify(
        error.message.includes("already")
          ? "Este e-mail já possui cadastro. Faça login."
          : "Não foi possível criar a conta agora.",
        "error",
      );
      return;
    }

    setDone(true);
    notify("Cadastro criado! Confirme o e-mail para ativar a conta.");
    router.refresh();
  }

  if (done) {
    return (
      <AuthCard
        title="Confirme seu e-mail"
        subtitle="Enviamos um link de confirmação para o endereço informado. Depois de confirmar, você já pode entrar."
      >
        <Button size="lg" fullWidth onClick={() => router.push("/conta/entrar")}>
          Ir para o login
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Criar conta"
      subtitle="Acompanhe seus pedidos, salve endereços e favoritos."
      footer={
        <p className="text-smoke-300">
          Já tem cadastro?{" "}
          <Link href="/conta/entrar" className="font-semibold text-neon-400 hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Nome completo" htmlFor="cad-nome" required error={errors.fullName?.message}>
          <Input id="cad-nome" autoComplete="name" {...register("fullName")} />
        </Field>

        <Field label="E-mail" htmlFor="cad-email" required error={errors.email?.message}>
          <Input id="cad-email" type="email" autoComplete="email" {...register("email")} />
        </Field>

        <Field label="WhatsApp" htmlFor="cad-phone" required error={errors.phone?.message}>
          <Input
            id="cad-phone"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            {...register("phone", {
              onChange: (event) => setValue("phone", formatPhone(event.target.value)),
            })}
          />
        </Field>

        <Field label="Senha" htmlFor="cad-password" required error={errors.password?.message}>
          <Input
            id="cad-password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
        </Field>

        <Field
          label="Confirmar senha"
          htmlFor="cad-confirm"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="cad-confirm"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
        </Field>

        <div className="flex items-start gap-3">
          <Checkbox id="cad-terms" {...register("acceptTerms")} />
          <label htmlFor="cad-terms" className="text-xs leading-relaxed text-smoke-300">
            Li e aceito os{" "}
            <Link href="/politicas/termos" className="text-neon-400 hover:underline">
              termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/politicas/privacidade" className="text-neon-400 hover:underline">
              política de privacidade
            </Link>
            .
          </label>
        </div>
        {errors.acceptTerms ? (
          <p className="text-xs font-medium text-red-400">{errors.acceptTerms.message}</p>
        ) : null}

        <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const supabase = getSupabaseBrowserClient();
  const { notify } = useToast();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof forgotPasswordSchema>) {
    if (!supabase) return;
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: absoluteUrl("/conta/redefinir-senha"),
    });
    // Mensagem neutra: não revelamos se o e-mail existe na base.
    setSent(true);
    notify("Se o e-mail estiver cadastrado, você receberá o link em instantes.");
  }

  return (
    <AuthCard
      title="Recuperar senha"
      subtitle="Informe o e-mail cadastrado para receber o link de redefinição."
      footer={
        <Link href="/conta/entrar" className="font-semibold text-neon-400 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <p className="rounded-lg border border-neon-500/35 bg-neon-500/5 p-4 text-sm text-smoke-200">
          Enviamos as instruções para o e-mail informado. Verifique também a caixa de spam.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field label="E-mail" htmlFor="rec-email" required error={errors.email?.message}>
            <Input id="rec-email" type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const { notify } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.infer<typeof resetPasswordSchema>) {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      notify("O link expirou. Solicite a redefinição novamente.", "error");
      return;
    }
    notify("Senha atualizada com sucesso!");
    router.push("/conta/perfil");
  }

  return (
    <AuthCard title="Definir nova senha" subtitle="Escolha uma senha com pelo menos 8 caracteres.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Nova senha" htmlFor="new-password" required error={errors.password?.message}>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
        </Field>
        <Field
          label="Confirmar senha"
          htmlFor="new-confirm"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="new-confirm"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
        </Field>
        <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </AuthCard>
  );
}
