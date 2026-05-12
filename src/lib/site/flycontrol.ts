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
      quantity: number;
      price: number;
      type?: string;
      notes?: string;
    }[];
    pizzeria_slug?: string;
    source?: string;
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
    paymentMethod?: string | null;
    changeFor?: number | null;
    pizzeria_slug?: string;
  }): FlycontrolOrderPayload {
    const items = args.items.map((l) => {
      const isPizza = !!(l.flavors && l.flavors.length > 0) || l.name.toLowerCase().includes("pizza");
      return {
        name: `${l.name}${l.sizeLabel ? ` (${l.sizeLabel})` : ""}`,
        quantity: l.quantity,
        price: l.unitPrice,
        type: isPizza ? "pizza" : "beverage",
        notes:
          l.flavors && l.flavors.length > 0
            ? `Sabores: ${l.flavors.join(" + ")}`
            : l.description || undefined,
      };
    });
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
      notes: (args.notes ?? "").trim(),
      pizzeria_slug: args.pizzeria_slug,
      source: "sitecreatorfly",
     created_at: new Date().toISOString(),
   };
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

 function resolveOrdersUrl(
   restaurant: Pick<RestaurantRow, "flycontrol_base_url" | "flycontrol_api_url">,
 ): string {
   console.log("[FLYCONTROL] Resolvendo endpoint de pedidos...");
   let specific = (restaurant.flycontrol_api_url ?? "").trim();
   let base = (restaurant.flycontrol_base_url ?? "").trim();
 
   // Forçar endpoint de pedidos: se o endpoint atual contiver "test", "connection" ou "check"
   // e tivermos uma base_url, ignoramos o específico e recalculamos.
   const isLikelyTestEndpoint = /test|connection|check|ping/i.test(specific);
   
   if (base && isLikelyTestEndpoint) {
     console.warn("[FLYCONTROL] Endpoint específico ignorado por parecer um teste:", specific);
     specific = "";
   }
 
   if (specific) {
     // Se o específico for apenas um domínio sem path de orders, tentamos completar
     if (!specific.includes("/orders") && !specific.includes("/create-order") && !specific.includes("/functions/v1/")) {
        base = specific;
        specific = "";
     } else {
        return specific;
     }
   }
 
   if (!base) return "";
 
   // Normalizar URL base
   if (!base.startsWith("http")) base = "https://" + base;
   base = base.replace(/\/+$/, "");
 
   // Heurística de endpoints de pedidos reais do FlyControl
   if (base.includes(".supabase.co")) {
     return joinUrl(base, "functions/v1/create-order");
   }
 
   // Padrão Lovable Cloud Server Function ou API Express/Next
   return joinUrl(base, "api/orders");
 }

 /** Sends an order to FLYCONTROL with exponential backoff retry. Throws on final failure. */
 export async function sendOrderToFlycontrol(
   restaurant: Pick<
     RestaurantRow,
     | "flycontrol_enabled"
     | "flycontrol_api_url"
     | "flycontrol_api_key"
     | "flycontrol_base_url"
   >,
   payload: FlycontrolOrderPayload,
   opts: { retries?: number; initialDelay?: number } = {},
 ): Promise<void> {
   if (!restaurant.flycontrol_enabled) return;
   const url = resolveOrdersUrl(restaurant);
   const key = (restaurant.flycontrol_api_key ?? "").trim();
   if (!url || !key) {
     console.error("[FLYCONTROL] Integração incompleta:", { url, key });
     throw new Error("Integração FLYCONTROL incompleta (URL/API Key).");
   }
 
    console.log("[FLYCONTROL] Iniciando finalização do pedido");
    console.log("[FLYCONTROL] Payload montado para FlyControl:", payload);
    console.log("[FLYCONTROL] Enviando para endpoint:", url);

    const finalPayload = { ...payload, api_key: key };
    const maxRetries = opts.retries ?? 3;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[FLYCONTROL] Enviando tentativa ${attempt + 1}/${maxRetries + 1}`);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(finalPayload),
        });

        const txt = await res.text().catch(() => "");
        let data: any = {};
        try {
          data = JSON.parse(txt);
        } catch (e) {
          data = { text: txt };
        }

        console.log("[FLYCONTROL] Resposta do FlyControl:", {
          status: res.status,
          data,
        });

        if (!res.ok) {
          throw new Error(`FLYCONTROL ${res.status}: ${txt || res.statusText}`);
        }

        if (data.status === "error" || data.success === false) {
          throw new Error(data.message || "Pedido rejeitado pelo FlyControl");
        }

        console.log("[FLYCONTROL] Pedido confirmado com sucesso!");
        return;
      } catch (err) {
        lastErr = err;
        console.error("[FLYCONTROL] Erro ao enviar pedido para FlyControl:", err);

        if (attempt < maxRetries) {
          const delay = (opts.initialDelay || 1000) * Math.pow(2, attempt);
          console.log(`[FLYCONTROL] Aguardando ${delay}ms para próxima tentativa...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
   throw lastErr instanceof Error ? lastErr : new Error("Falha definitiva ao enviar pedido para o FlyControl");
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