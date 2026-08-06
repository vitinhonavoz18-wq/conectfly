import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "dark" | "whatsapp" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-wide uppercase transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-500";

const variants: Record<Variant, string> = {
  primary:
    "bg-neon-500 text-ink-950 hover:bg-neon-400 active:bg-neon-600 shadow-[0_10px_30px_-14px_rgba(41,226,61,0.9)] hover:shadow-[0_14px_36px_-12px_rgba(41,226,61,0.95)]",
  outline:
    "border border-ink-500 text-smoke-100 hover:border-neon-500 hover:text-neon-400 hover:bg-neon-500/5",
  ghost: "text-smoke-300 hover:text-neon-400 hover:bg-white/5",
  dark: "bg-ink-700 text-smoke-100 hover:bg-ink-600 border border-ink-600",
  whatsapp: "bg-[#1FA02F] text-white hover:bg-[#188427]",
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
