import { cn, discountPercent, effectivePrice, formatCurrency, installmentPlan } from "@/lib/utils";

export function PriceTag({
  price,
  salePrice,
  size = "md",
  showInstallments = true,
  className,
}: {
  price: number;
  salePrice?: number | null;
  size?: "sm" | "md" | "lg";
  showInstallments?: boolean;
  className?: string;
}) {
  const current = effectivePrice(price, salePrice);
  const discount = discountPercent(price, salePrice);
  const plan = installmentPlan(current);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {discount ? (
          <span
            className={cn(
              "text-smoke-400 line-through",
              size === "lg" ? "text-base" : "text-xs",
            )}
          >
            {formatCurrency(price)}
          </span>
        ) : null}
        <span
          className={cn(
            "font-extrabold tracking-tight text-white",
            size === "sm" && "text-base",
            size === "md" && "text-lg",
            size === "lg" && "text-3xl",
          )}
        >
          {formatCurrency(current)}
        </span>
        {discount ? (
          <span className="rounded-md bg-neon-500 px-1.5 py-0.5 text-[10px] font-bold text-ink-950">
            -{discount}%
          </span>
        ) : null}
      </div>

      {showInstallments && plan.count > 1 ? (
        <p className={cn("text-smoke-400", size === "lg" ? "text-sm" : "text-[11px]")}>
          até <strong className="font-semibold text-smoke-200">{plan.count}x</strong> de{" "}
          {formatCurrency(plan.value)} sem juros
        </p>
      ) : null}
    </div>
  );
}
