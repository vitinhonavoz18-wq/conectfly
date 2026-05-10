import type { CartLine, RestaurantRow } from "./types";

 export interface FlycontrolOrderPayload {
   api_key?: string;
   order_id: string;
   customer: { 
     name: string; 
     phone: string; 
     address: string;
     neighborhood?: string;
   };
   items: { 
     name: string; 
     qty: number; 
     price: number; 
     notes?: string 
   }[];
   total: number;
   delivery_fee?: number;
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
     qty: l.quantity,
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
     customer: { 
       name: args.name, 
       phone: args.phone,
       address: args.address,
       neighborhood: args.neighborhood ?? undefined
     },
     items,
     total: args.subtotal + fee,
     delivery_fee: fee,
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
   const specific = (restaurant.flycontrol_api_url ?? "").trim();
   if (specific) return specific;
 
   let base = (restaurant.flycontrol_base_url ?? "").trim();
   if (!base) return "";
 
   // Normalizar URL (remover barras extras e garantir protocolo)
   if (!base.startsWith("http")) base = "https://" + base;
   base = base.replace(/\/+$/, "");
 
   // Se já for um endpoint completo
   if (
     base.includes("/functions/v1/") ||
     base.endsWith("/api/orders") ||
     base.endsWith("/create-order") ||
     base.endsWith("/orders")
   ) {
     return base;
   }
 
   // Se for uma URL da Supabase (Edge Function)
   if (base.includes(".supabase.co")) {
     return joinUrl(base, "functions/v1/create-order");
   }
 
   // Padrão Lovable Cloud Server Function
   return joinUrl(base, "api/orders");
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
   if (!url || !key) {
     console.error("[FLYCONTROL] Integração incompleta:", { url, key });
     throw new Error("Integração FLYCONTROL incompleta (URL/API Key).");
   }
 
   const finalPayload = { ...payload, api_key: key };

  const retries = Math.max(0, opts.retries ?? 2);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
       console.log(`[FLYCONTROL] Enviando pedido para ${url} (tentativa ${attempt + 1})`);
       const res = await fetch(url, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "x-api-key": key,
           Authorization: `Bearer ${key}`,
         },
         body: JSON.stringify(finalPayload),
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
 */
 export async function registerPizzeriaInFlycontrol(
   baseUrl: string,
   body: {
     name: string;
     phone: string;
     address: string;
     slug: string;
     api_key?: string;
   },
   registerUrl?: string | null
 ): Promise<FlycontrolRegisterResponse & { order_endpoint?: string }> {
   let base = (baseUrl ?? "").trim();
   if (base && !base.startsWith("http")) base = "https://" + base;
   base = base.replace(/\/+$/, "");
   
   const endpoints = registerUrl ? [registerUrl.trim()] : [];
   
   if (base) {
     if (base.includes(".supabase.co") && !base.includes("/functions/v1/")) {
       endpoints.push(joinUrl(base, "functions/v1/create-pizzeria"));
     }
     endpoints.push(
       joinUrl(base, "api/pizzerias/create"),
       joinUrl(base, "create-pizzeria"),
       joinUrl(base, "api/pizzerias/vincular")
     );
   }
 
   if (endpoints.length === 0) {
     throw new Error("URL base ou Endpoint de Registro do FLYCONTROL não configurados.");
   }

  let lastErr: Error | null = null;
   console.log(`[FLYCONTROL] Iniciando registro/vinculação. Tentando ${endpoints.length} endpoints...`);
   
   for (const url of endpoints) {
     try {
       console.log(`[FLYCONTROL] Tentando endpoint: ${url}`);
       const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ ...body, action: 'vincular_ou_criar' }),
       });
       
       if (!res.ok) {
         const txt = await res.text().catch(() => "");
         console.warn(`[FLYCONTROL] Falha no endpoint ${url}: ${res.status} ${txt}`);
         throw new Error(`FLYCONTROL ${res.status}: ${txt || res.statusText}`);
       }
       
       const data = (await res.json()) as any;
       console.log(`[FLYCONTROL] Resposta recebida de ${url}:`, data);
      const tenant_id = data.tenant_id || data.id || data.pizzaria_id;
      const api_key = data.api_key || data.key || data.apiKey;
      
      if (!tenant_id || !api_key) {
        console.error("Flycontrol response missing fields:", data);
        throw new Error(
          "Resposta do FLYCONTROL incompleta. Verifique se o endpoint está correto.",
        );
      }
      return {
        tenant_id,
        api_key,
        order_endpoint: data.order_endpoint || data.endpoint
      };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }
  throw lastErr || new Error("Falha ao registrar");
}