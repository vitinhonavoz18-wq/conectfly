"use client";

import { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { orderStatusLabels, type OrderStatus } from "@/types/catalog";

type AdminOrder = {
  id: string;
  code: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  total: number;
  createdAt: string;
  items: { id: string; productName: string; size: string; color: string; quantity: number }[];
};

export function OrdersManager() {
  const supabase = getSupabaseBrowserClient();
  const { notify } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "todos">("todos");

  const loader = useCallback(async (): Promise<AdminOrder[]> => {
    if (!supabase) return [];
    const { data } = await supabase
      .from("orders")
      .select("*, items:order_items(*)")
      .order("created_at", { ascending: false })
      .limit(200);

    return (data ?? []).map((row) => ({
        id: row.id as string,
        code: row.code as string,
        status: (row.status as OrderStatus) ?? "aguardando",
        customerName: (row.customer_name as string) ?? "",
        customerPhone: (row.customer_phone as string) ?? "",
        total: Number(row.total ?? 0),
        createdAt: row.created_at as string,
        items: ((row.items as Record<string, unknown>[]) ?? []).map((item) => ({
          id: item.id as string,
          productName: (item.product_name as string) ?? "",
          size: (item.size as string) ?? "",
          color: (item.color as string) ?? "",
        quantity: Number(item.quantity ?? 1),
      })),
    }));
  }, [supabase]);

  const { data: orders, refresh: load } = useAsyncData<AdminOrder[]>(loader, []);

  async function updateStatus(orderId: string, status: OrderStatus) {
    if (!supabase) return;
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) {
      notify("Não foi possível alterar o status.", "error");
      return;
    }
    notify(`Status atualizado para "${orderStatusLabels[status]}".`);
    void load();
  }

  if (orders === null) return <div className="h-64 animate-pulse rounded-card bg-ink-900" />;

  const visible =
    statusFilter === "todos" ? orders : orders.filter((order) => order.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["todos", ...Object.keys(orderStatusLabels)] as (OrderStatus | "todos")[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              statusFilter === status
                ? "border-neon-500 bg-neon-500/10 text-neon-400"
                : "border-ink-600 text-smoke-300 hover:border-smoke-400"
            }`}
          >
            {status === "todos" ? "Todos" : orderStatusLabels[status as OrderStatus]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-14 text-center text-sm text-smoke-300">
          Nenhum pedido neste filtro.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((order) => (
            <li key={order.id} className="rounded-card border border-ink-700 bg-ink-900">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    className="flex items-center gap-2 text-sm font-bold text-white hover:text-neon-400"
                    aria-expanded={expanded === order.id}
                  >
                    Pedido {order.code}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        expanded === order.id ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <p className="mt-1 text-xs text-smoke-400">
                    {order.customerName} · {order.customerPhone} · {formatDateTime(order.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-extrabold text-white">
                    {formatCurrency(order.total)}
                  </span>
                  <label htmlFor={`status-${order.id}`} className="sr-only">
                    Status do pedido {order.code}
                  </label>
                  <select
                    id={`status-${order.id}`}
                    value={order.status}
                    onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)}
                    className="h-10 rounded-lg border border-ink-600 bg-ink-850 px-3 text-xs font-semibold text-smoke-200 focus:border-neon-500 focus:outline-none"
                  >
                    {Object.entries(orderStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {expanded === order.id ? (
                <ul className="divide-y divide-ink-700 border-t border-ink-700 px-5 text-sm text-smoke-300">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-4 py-3">
                      <span>{item.productName}</span>
                      <span className="text-smoke-400">
                        {item.size} · {item.color} · {item.quantity}x
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
