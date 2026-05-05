import type { CartLine, RestaurantRow } from "./types";

export interface FlycontrolOrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  neighborhood?: string | null;
  delivery_fee?: number;
  items: { name: string; quantity: number; price: number; notes?: string }[];
  total: number;
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
    customer_name: args.name,
    customer_phone: args.phone,
    customer_address: args.address,
    neighborhood: args.neighborhood ?? null,
    delivery_fee: fee,
    items,
    total: args.subtotal + fee,
    payment_method: args.paymentMethod ?? null,
    change_for: args.changeFor ?? null,
    notes: args.notes ?? "",
    created_at: new Date().toISOString(),
  };
}

/** Sends an order to FLYCONTROL with simple retry. Throws on final failure. */
export async function sendOrderToFlycontrol(
  restaurant: Pick<
    RestaurantRow,
    "flycontrol_enabled" | "flycontrol_api_url" | "flycontrol_api_key"
  >,
  payload: FlycontrolOrderPayload,
  opts: { retries?: number } = {},
): Promise<void> {
  if (!restaurant.flycontrol_enabled) return;
  const url = (restaurant.flycontrol_api_url ?? "").trim();
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