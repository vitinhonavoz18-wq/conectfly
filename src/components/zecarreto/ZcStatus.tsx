/**
 * Etiquetas de status e lista de pendências.
 * A cor e a palavra dizem a mesma coisa — quem não enxerga cor continua
 * entendendo o recado.
 */

import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DRIVER_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Cadastro incompleto", tone: "bg-neutral-200 text-neutral-800" },
  under_review: { label: "Em análise", tone: "bg-amber-100 text-amber-900" },
  approved: { label: "Aprovado", tone: "bg-emerald-100 text-emerald-900" },
  rejected: { label: "Não aprovado", tone: "bg-red-100 text-red-900" },
  suspended: { label: "Suspenso", tone: "bg-red-100 text-red-900" },
};

const VEHICLE_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Aguardando análise", tone: "bg-amber-100 text-amber-900" },
  approved: { label: "Aprovado", tone: "bg-emerald-100 text-emerald-900" },
  rejected: { label: "Não aprovado", tone: "bg-red-100 text-red-900" },
  inactive: { label: "Inativo", tone: "bg-neutral-200 text-neutral-700" },
};

const DOCUMENT_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Enviado", tone: "bg-amber-100 text-amber-900" },
  under_review: { label: "Em análise", tone: "bg-amber-100 text-amber-900" },
  approved: { label: "Aprovado", tone: "bg-emerald-100 text-emerald-900" },
  rejected: { label: "Recusado", tone: "bg-red-100 text-red-900" },
  expired: { label: "Vencido", tone: "bg-red-100 text-red-900" },
};

export function ZcStatusBadge({
  status,
  kind = "driver",
}: {
  status: string;
  kind?: "driver" | "vehicle" | "document";
}) {
  const table =
    kind === "vehicle" ? VEHICLE_LABELS : kind === "document" ? DOCUMENT_LABELS : DRIVER_LABELS;
  const entry = table[status] ?? { label: status, tone: "bg-neutral-200 text-neutral-800" };
  return (
    <span
      className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", entry.tone)}
    >
      {entry.label}
    </span>
  );
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  hint?: string;
}

export function ZcChecklist({ steps }: { steps: ChecklistItem[] }) {
  return (
    <ul className="space-y-2">
      {steps.map((step) => (
        <li key={step.key} className="flex items-start gap-2 text-sm">
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              step.done ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500",
            )}
          >
            {step.done ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          </span>
          <span>
            <span className={cn(step.done ? "text-neutral-500 line-through" : "font-medium")}>
              {step.label}
            </span>
            {!step.done && step.hint && (
              <span className="block text-xs text-neutral-500">{step.hint}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ZcRejectionNote({ reason }: { reason?: string | null }) {
  if (!reason) return null;
  return (
    <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <X className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong className="block">O que precisa ser corrigido</strong>
        {reason}
      </span>
    </div>
  );
}
