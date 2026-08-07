import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "dark" | "whatsapp" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[9px] font-bold tracking-[0.04em] uppercase transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-500";

const variants: Record<Variant, string> = {
  primary:
    "bg-neon-500 text-[#031006] shadow-[0_10px_32px_rgba(32,232,63,0.20)] hover:-translate-y-0.5 hover:bg-neon-400 hover:shadow-[0_15px_38px_rgba(32,232,63,0.28)] active:translate-y-0",
  outline:
    "border border-white/12 text-smoke-100 hover:-translate-y-0.5 hover:border-neon-500/60 hover:text-neon-400",
  ghost: "text-smoke-300 hover:text-neon-400 hover:bg-white/5",
  dark: "border border-white/8 bg-white/5 text-smoke-100 hover:bg-white/8",
  whatsapp: "bg-[#0C8F27] text-white hover:-translate-y-0.5 hover:bg-[#0f9e2d]",
  danger: "border border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[11px]",
  md: "h-11 px-5 text-xs",
  lg: "h-13 px-7 text-sm",
  icon: "h-10 w-10",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: CommonProps = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

export type ButtonProps = CommonProps & ComponentPropsWithoutRef<"button">;

export function Button({ variant, size, fullWidth, className, ...props }: ButtonProps) {
  return <button className={buttonClasses({ variant, size, fullWidth, className })} {...props} />;
}

export type ButtonLinkProps = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "className">;

export function ButtonLink({ variant, size, fullWidth, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, fullWidth, className })} {...props} />;
}
