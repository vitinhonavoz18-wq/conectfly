import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 text-sm text-smoke-100 placeholder:text-smoke-400/70 transition-colors focus:border-neon-500 focus:outline-none focus:ring-1 focus:ring-neon-500/40 disabled:opacity-50";

export function Label({
  className,
  required,
  children,
  ...props
}: ComponentPropsWithoutRef<"label"> & { required?: boolean }) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-smoke-300",
        className,
      )}
      {...props}
    >
      {children}
      {required ? <span className="ml-1 text-neon-500">*</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn(controlBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(
        controlBase,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238b918d%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:18px] bg-[right_0.75rem_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4.5 w-4.5 shrink-0 cursor-pointer appearance-none rounded border border-ink-500 bg-ink-850 transition-colors checked:border-neon-500 checked:bg-neon-500 checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23050505%22 stroke-width=%223%22><path d=%22M20 6L9 17l-5-5%22/></svg>')] checked:bg-center checked:bg-no-repeat checked:[background-size:14px]",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-400">{children}</p>;
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs text-smoke-400">{hint}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}
