import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Accordion({
  items,
  className,
}: {
  items: { id?: string; question: string; answer: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-ink-700 overflow-hidden rounded-card border border-ink-700 bg-ink-900", className)}>
      {items.map((item, index) => (
        <details key={item.id ?? index} className="group" id={item.id}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-smoke-100 transition-colors hover:text-neon-400 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown className="h-4 w-4 shrink-0 text-smoke-400 transition-transform duration-300 group-open:rotate-180 group-open:text-neon-500" />
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-smoke-300">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
