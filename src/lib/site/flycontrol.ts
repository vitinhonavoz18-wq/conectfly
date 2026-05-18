import type { CartLine, RestaurantRow } from "./types";

export interface FlycontrolOrderPayload {
  event: "order.created";
  source: "sitecreatorfly";
  pizzeria: {
    slug: string;
    name: string;
  };
  customer: {
    name: string;
    phone: string;
    address: string;
    neighborhood: string | null;
    reference: string | null;
  };
  order: {
    id: string;
    created_at: string;
    items: any[];
    subtotal: number;
    delivery_fee: number;
    total: number;
    payment_method: string;
    change_for: number | null;
    delivery_type: "delivery" | "retirada";
    notes: string;
    whatsapp_message: string;
  };
  api_key?: string; // Mantido para envio interno se necessário
}

export function buildOrderPayload(args: {
  name: string;
  phone: string;
  address: string;
  neighborhood?: string | null;
  reference?: string | null;
  deliveryFee?: number;
  items: CartLine[];
  subtotal: number;
  total: number;
  notes?: string;
  paymentMethod?: string | null;
  changeFor?: number | null;
  pizzeria_slug: string;
  pizzeria_name: string;
  whatsapp_message: string;
  delivery_type?: "delivery" | "retirada";
}): FlycontrolOrderPayload {
   const items = args.items.map((l) => {
     const isBeverage = l.itemId.startsWith('bev-');
     const isCombo = l.itemId.startsWith('combo-');
     const isPizza = !isBeverage && !isCombo && (!!(l.flavors && l.flavors.length > 0) || l.name.toLowerCase().includes("pizza"));
     
     if (isPizza) {
       return {
         type: "pizza",
         size: l.sizeLabel || "Padrão",
         flavors: l.flavors && l.flavors.length > 0 ? l.flavors : [l.name],
         quantity: l.quantity,
         unit_price: l.unitPrice,
         total_price: l.unitPrice * l.quantity,
         notes: l.description || ""
       };
     } else if (isCombo) {
       return {
         type: "combo",
         name: l.name,
         items: l.description.split(" • ").flatMap(d => d.split(" + ")).map(i => i.trim()),
         quantity: l.quantity,
         unit_price: l.unitPrice,
         total_price: l.unitPrice * l.quantity,
         notes: ""
       };
     } else {
       return {
         type: "beverage",
         name: l.name,
         quantity: l.quantity,
         unit_price: l.unitPrice,
         total_price: l.unitPrice * l.quantity
       };
     }
   });

  return {
    event: "order.created",
    source: "sitecreatorfly",
    pizzeria: {
      slug: args.pizzeria_slug,
      name: args.pizzeria_name
    },
    customer: {
      name: args.name,
      phone: args.phone,
      address: args.address,
      neighborhood: args.neighborhood || null,
      reference: args.reference || null
    },
    order: {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
      items,
      subtotal: args.subtotal,
      delivery_fee: args.deliveryFee ?? 0,
      total: args.total,
      payment_method: args.paymentMethod || "PIX",
      change_for: args.changeFor || null,
      delivery_type: args.delivery_type || "delivery",
      notes: (args.notes ?? "").trim(),
      whatsapp_message: args.whatsapp_message
    }
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
 
  if (specific) {
    if (!specific.startsWith("http")) specific = "https://" + specific;
    return specific.trim();
  }

  if (!base) return "";
 
   // Normalizar URL base
   if (!base.startsWith("http")) base = "https://" + base;
   base = base.replace(/\/+$/, "");
 
   // Heurística de endpoints de pedidos reais do FlyControl
   if (base.includes(".supabase.co")) {
     return joinUrl(base, "functions/v1/create-order");
   }
 
  return joinUrl(base, "api/orders");
}

/** 
 * Test connection directly to the orders endpoint without proxy
 * This is used for debugging and direct verification.
 */
export async function testFlycontrolConnection(
  endpoint: string,
  apiKey: string,
  slug: string
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const payload = {
    event: "order.created",
    source: "sitecreatorfly-test",
    pizzeria: {
      slug: slug || "cheirosa-pizzaria",
      name: "CHEIROSA PIZZARIA (TESTE)"
    },
    customer: {
      name: "Cliente Teste",
      phone: "71999999999",
      address: "Rua Teste",
      neighborhood: "Bairro Teste",
      reference: "Teste"
    },
    order: {
      id: "teste-" + Date.now(),
      created_at: new Date().toISOString(),
      items: [
        {
          type: "pizza",
          size: "Grande",
          flavors: ["Calabresa"],
          quantity: 1,
          unit_price: 55,
          total_price: 55,
          notes: ""
        }
      ],
      subtotal: 55,
      delivery_fee: 15,
      total: 70,
      payment_method: "PIX",
      change_for: null,
      delivery_type: "delivery",
      notes: "Pedido de teste",
      whatsapp_message: "Pedido teste"
    }
  };

  try {
    console.log("🧪 Testando conexão direta com FlyControl");
    console.log("URL:", endpoint);
    console.log("API Key (trimmed):", apiKey.trim().slice(0, 8) + "...");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim()
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseText = await response.text();
    
    let data = null;
    try { data = JSON.parse(responseText); } catch { data = { text: responseText }; }

    return {
      success: response.ok,
      status: response.status,
      data,
      url: endpoint,
      apiKeyExists: !!apiKey,
      slugUsed: slug
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: error.message,
      url: endpoint,
      apiKeyExists: !!apiKey,
      slugUsed: slug
    };
  }
 }

/** Sends an order to FLYCONTROL with exponential backoff retry. Throws on final failure. */
export async function sendOrderToFlycontrol(
  restaurant: Pick<
    RestaurantRow,
    | "id"
    | "flycontrol_enabled"
    | "flycontrol_api_url"
    | "flycontrol_api_key"
    | "flycontrol_base_url"
  >,
  payload: FlycontrolOrderPayload,
  opts: { retries?: number; initialDelay?: number; signal?: AbortSignal } = {},
): Promise<void> {
  // 1. Validações pré-envio conforme solicitado
  const missingFields: string[] = [];
  if (!payload.pizzeria?.slug) missingFields.push("pizzeria.slug");
  if (!payload.customer?.name) missingFields.push("customer.name");
  if (!payload.customer?.phone) missingFields.push("customer.phone");
  if (!payload.customer?.address) missingFields.push("customer.address");
  if (!payload.order?.items || payload.order.items.length === 0) missingFields.push("order.items");
  if (payload.order?.total === undefined || payload.order?.total === null) missingFields.push("order.total");

  if (missingFields.length > 0) {
  const errorMsg = `Campos obrigatórios ausentes: ${missingFields.join(", ")}`;
  console.error("Erro de validação antes do POST:", errorMsg);
  console.log("Payload incompleto:", payload);
  throw new Error(errorMsg);
  }

  // 2. Consistência de dados
if (payload.order.total <= 0) {
  console.warn("Aviso: Total do pedido é zero ou negativo:", payload.order.total);
}

   if (!restaurant.flycontrol_enabled) return;

  if (!restaurant.id) {
    throw new Error("restaurant.id ausente para envio do pedido.");
  }

  console.log("🚀 Enviando pedido para FlyControl (via Proxy Seguro)");
  console.log("🔗 Proxy:", "/api/public/submit-order");
  console.log("🔐 ID da Pizzaria:", restaurant.id);
  console.log("📦 Payload:", payload);

  const response = await fetch("/api/public/submit-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-idempotency-key": payload.order.id,
    },
    body: JSON.stringify({ restaurant_id: restaurant.id, payload }),
    signal: opts.signal,
  });

  const responseText = await response.text();
  let data: any = {};
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { text: responseText };
  }

  console.log("📡 Status Proxy:", response.status);
  console.log("📡 Resposta Proxy:", responseText);

  if (!response.ok || data?.success === false) {
    const errorMsg = data?.error || `Falha no envio: ${response.status}`;
    console.error("❌ Erro ao registrar no FlyControl:", errorMsg);
    throw new Error(errorMsg);
  }

  console.log("✅ Pedido registrado no FlyControl com sucesso");
  // opts kept for backwards compat; retry handled server-side
  void opts;
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