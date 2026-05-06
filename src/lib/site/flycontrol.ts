import type { CartLine, RestaurantRow } from "./types";

export interface FlycontrolOrderPayload {
  order_id: string;
  customer: { name: string; phone: string };
  address: { street: string; number: string; neighborhood: string };
  items: { name: string; quantity: number; price: number; notes?: string }[];
  total: number;
  delivery_fee: number;
  payment_method?: string | null;
  change_for?: number | null;
  notes?: string;
  created_at: string;
}

export function buildOrderPayload(args: {
  name: string;
  phone: string;
  address: string;
  neighborhood?: string | null;
  deliveryFee?: number;
  items: CartLine[];
  subtotal: number;
  notes?: string;
  paymentMethod?: string;
  changeFor?: number;
}): FlycontrolOrderPayload {
  const items = args.items.map((l) => ({
    name: `${l.name}${l.sizeLabel ? ` (${l.sizeLabel})` : ""}`,
    quantity: l.quantity,
    price: l.unitPrice,
    notes:
      l.flavors && l.flavors.length > 0
        ? `Sabores: ${l.flavors.join(" + ")}`
        : l.description || undefined,
  }));
  const fee = args.deliveryFee ?? 0;
  return {
    order_id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    customer: { name: args.name, phone: args.phone },
    address: {
      street: args.address,
      number: "",
      neighborhood: args.neighborhood ?? "",
    },
    delivery_fee: fee,
    items,
    total: args.subtotal + fee,
    payment_method: args.paymentMethod ?? null,
    change_for: args.changeFor ?? null,
    notes: args.notes ?? "",
    created_at: new Date().toISOString(),
  };
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

function resolveOrdersUrl(
  restaurant: Pick<RestaurantRow, "flycontrol_base_url" | "flycontrol_api_url">,
): string {
  const base = (restaurant.flycontrol_base_url ?? "").trim();
  if (base) return joinUrl(base, "api/orders");
  return (restaurant.flycontrol_api_url ?? "").trim();
}

/** Sends an order to FLYCONTROL with simple retry. Throws on final failure. */
export async function sendOrderToFlycontrol(
  restaurant: Pick<
    RestaurantRow,
    | "flycontrol_enabled"
    | "flycontrol_api_url"
    | "flycontrol_api_key"
    | "flycontrol_base_url"
  >,
  payload: FlycontrolOrderPayload,
  opts: { retries?: number } = {},
): Promise<void> {
  if (!restaurant.flycontrol_enabled) return;
  const url = resolveOrdersUrl(restaurant);
  const key = (restaurant.flycontrol_api_key ?? "").trim();
  if (!url || !key) throw new Error("Integração FLYCONTROL incompleta (URL/API Key).");

  const retries = Math.max(0, opts.retries ?? 2);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`FLYCONTROL ${res.status}: ${txt || res.statusText}`);
      }
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Falha ao enviar pedido");
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (
    "fc_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface FlycontrolRegisterResponse {
  tenant_id: string;
  api_key: string;
}

/**
 * Auto-registers a pizzaria on FLYCONTROL.
 * POST {base_url}/api/pizzerias/create
 * Returns { tenant_id, api_key } generated server-side.
 */
export async function registerPizzeriaInFlycontrol(
  baseUrl: string,
  body: { name: string; phone: string; address: string; slug: string },
): Promise<FlycontrolRegisterResponse> {
  const base = (baseUrl ?? "").trim();
  if (!base) throw new Error("URL base do FLYCONTROL não configurada.");
  const url = joinUrl(base, "api/pizzerias/create");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`FLYCONTROL ${res.status}: ${txt || res.statusText}`);
  }
  const data = (await res.json()) as Partial<FlycontrolRegisterResponse>;
  if (!data.tenant_id || !data.api_key) {
    throw new Error("Resposta inválida do FLYCONTROL (faltando tenant_id/api_key).");
  }
  return { tenant_id: data.tenant_id, api_key: data.api_key };
}