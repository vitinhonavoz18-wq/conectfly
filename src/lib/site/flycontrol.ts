import type { CartLine, RestaurantRow } from "./types";
import { safeInvoke } from "./api-utils";
import { formatBRL } from "./format";
import { FEATURES } from "../features";

export interface OpenTableSessionPayload {
  type: "open_table_session";
  restaurant_slug: string;
  order_type: "table";
  service_mode: "mesa";
  table_number: string;
  table_token: string;
  customer_name?: string;
  customer_phone?: string;
  opened_from: "qrcode_scan";
  opened_at: string;
}



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
    delivery_type: "delivery" | "retirada" | "mesa";
    order_type?: "delivery" | "pickup" | "table";
    service_mode?: "delivery" | "retirada" | "mesa";
    table_number?: string | null;
    table_id?: string | null;
    table_token?: string | null;
    table_session_id?: string | null;
    ticket_number?: string | null;

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
  delivery_type?: "delivery" | "retirada" | "mesa";
  table_number?: string | null;
  table_id?: string | null;
  table_token?: string | null;
  table_session_id?: string | null;
  ticket_number?: string | null;
  order_type?: "delivery" | "pickup" | "table";
  service_mode?: "delivery" | "retirada" | "mesa";
}): FlycontrolOrderPayload {
   const items = args.items.map((l) => {

     const isBeverage = l.itemId.startsWith('bev-');
     const isCombo = l.itemId.startsWith('combo-');
     const isPizza = !isBeverage && !isCombo && ((l.flavors && l.flavors.length > 0) || l.name.toLowerCase().includes("pizza"));
     
     // Tentar extrair borda da descrição
     let crust = "";
     if (l.description && l.description.toLowerCase().includes("borda")) {
       const match = l.description.match(/borda:?\s*([^•\+\n,]+)/i);
       if (match) crust = match[1].trim();
     }

     if (isPizza) {
       return {
         type: "pizza",
         name: l.name,
         size: l.sizeLabel || "Padrão",
         flavors: l.flavors && l.flavors.length > 0 ? l.flavors : [l.name],
         crust: crust,
         extras: l.extras || 0,
         quantity: Number(l.quantity) || 0,
         unit_price: Number(l.unitPrice) || 0,
         total_price: (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0),
         notes: (l.description || "").trim()
       };
     } else if (isCombo) {
       return {
         type: "combo",
         name: l.name,
         items: (l.description || "").split(/[•\+\n]/).map(i => i.trim()).filter(Boolean),
         quantity: Number(l.quantity) || 0,
         unit_price: Number(l.unitPrice) || 0,
         total_price: (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0),
         notes: ""
       };
     } else if (isBeverage) {
       return {
         type: "beverage",
         name: l.name,
         quantity: Number(l.quantity) || 0,
         unit_price: Number(l.unitPrice) || 0,
         total_price: (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0),
         notes: (l.description || "").trim()
       };
     } else {
       return {
         type: "other",
         name: l.name,
         quantity: Number(l.quantity) || 0,
         unit_price: Number(l.unitPrice) || 0,
         total_price: (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0),
         notes: (l.description || "").trim()
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
       subtotal: Number(args.subtotal) || 0,
       delivery_fee: Number(args.deliveryFee) || 0,
       total: Number(args.total) || 0,
      payment_method: args.paymentMethod || "PIX",
       change_for: args.changeFor ? Number(args.changeFor) : null,
      delivery_type: args.delivery_type || "delivery",
      order_type: args.order_type || (args.delivery_type === "retirada" ? "pickup" : (args.delivery_type === "mesa" ? "table" : "delivery")),
      service_mode: args.service_mode || args.delivery_type || "delivery",
      table_number: args.table_number || null,
      table_id: args.table_id || null,
      table_token: args.table_token || null,
      table_session_id: args.table_session_id || null,
      ticket_number: args.ticket_number || null,

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

export function resolveTablesUrl(
  restaurant: Pick<RestaurantRow, "flycontrol_base_url" | "flycontrol_api_url">,
): string {
  console.log("[FLYCONTROL] Resolvendo endpoint de mesas...");
  let base = (restaurant.flycontrol_base_url ?? "").trim();
  
  if (!base) return "";
  
  // Normalizar URL base
  if (!base.startsWith("http")) base = "https://" + base;
  base = base.replace(/\/+$/, "");

  // Se for uma URL do Supabase, usa o caminho padrão de functions
  if (base.includes(".supabase.co")) {
    return joinUrl(base, "functions/v1/public-tables");
  }

  // Se for o domínio do FlyControl Lovable Dash, as functions ficam em /functions/v1/
  if (base.includes("flycontrol-dash.lovable.app") || base.includes("lovable.app")) {
     return joinUrl(base, "functions/v1/public-tables");
  }

  // Fallback para domínios customizados (como conectfly.com.br)
  // O usuário espera api/public/validate-table, então o base deve retornar api/public
  // De acordo com as instruções: {{FLYCONTROL_BASE_URL}}/api/public/restaurant-tables
  return joinUrl(base, "api/public");
}

/** 
 * Test connection directly to the orders endpoint without proxy
 * This is used for debugging and direct verification.
 */
export async function testFlycontrolConnection(
  restaurantId: string,
  slug: string
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    console.log("[FLYCONTROL] 🧪 Iniciando teste de conexão via Proxy Seguro...");
    const supabaseClient = (await import("@/integrations/supabase/client")).supabase;
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session?.access_token) {
      console.warn("[FLYCONTROL] ⚠️ Sessão não encontrada para o teste de conexão.");
    }

    const response = await fetch("/api/public/submit-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ 
        restaurant_id: restaurantId, 
        test: true 
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const status = response.status;
    const responseText = await response.text();
    
    console.log(`[FLYCONTROL] 📡 Proxy retornou status: ${status}`);

    let result: any = null;
    try { 
      result = JSON.parse(responseText); 
    } catch { 
      result = { text: responseText.slice(0, 500) }; 
    }

    return {
      success: response.ok && result.success === true,
      status: status,
      data: result.response || result,
      details: result.details || null,
      error: result.error || (response.ok ? null : `Erro HTTP ${status}`),
      url: result.endpoint || result?.details?.endpoint_called || "/api/public/submit-order",
      apiKeyExists: true,
      slugUsed: slug
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError' || error.message?.includes("aborted");
    console.error("❌ Erro no teste de conexão:", error);
    return {
      success: false,
      error: isTimeout ? "Timeout: O servidor demorou muito para responder (20s)." : error.message,
      url: "/api/public/submit-order",
      apiKeyExists: true,
      slugUsed: slug,
      status: 0
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
    // flycontrol_api_key removed from frontend payload - handled by server proxy
    | "flycontrol_base_url"
  >,
  payload: FlycontrolOrderPayload,
  opts: { retries?: number; initialDelay?: number; signal?: AbortSignal } = {},
): Promise<{ success: boolean; skipped?: boolean; message?: string; order_id?: string }> {
  console.log("[FLYCONTROL] 🚀 Iniciando envio para FlyControl");
  console.log("[FLYCONTROL] ℹ️ Integração ativa:", !!restaurant.flycontrol_enabled);

  if (!restaurant.flycontrol_enabled) {
    console.log("[FLYCONTROL] ℹ️ Integração FlyControl desativada para esta pizzaria");
    return { success: false, skipped: true, message: "Integração desativada" };
  }

  // LOGS OBRIGATÓRIOS DO CHECKOUT
  console.log("CHECKOUT_ORDER_TYPE:", payload.order.order_type);
  console.log("CHECKOUT_SERVICE_MODE:", payload.order.service_mode);
  console.log("CHECKOUT_TABLE_NUMBER:", payload.order.table_number);
  console.log("CHECKOUT_TABLE_TOKEN:", payload.order.table_token);
  console.log("CHECKOUT_TABLE_SESSION_ID:", payload.order.table_session_id);


  // 1. Validações pré-envio
  const missingFields: string[] = [];
  if (!payload.pizzeria?.slug) missingFields.push("pizzeria.slug");
  if (!payload.customer?.name) missingFields.push("customer.name");
  if (!payload.customer?.phone) missingFields.push("customer.phone");
  
  // Endereço é obrigatório apenas para delivery
  if (payload.order.order_type === "delivery" && !payload.customer?.address) {
    missingFields.push("customer.address");
  }

  if (!payload.order?.items || payload.order.items.length === 0) missingFields.push("order.items");
  if (payload.order?.total === undefined || payload.order?.total === null) missingFields.push("order.total");

  // Mesa exige número e token
  if (payload.order.order_type === "table") {
    if (!payload.order.table_number) missingFields.push("table_number");
    if (!payload.order.table_token) missingFields.push("table_token");
  }

  if (missingFields.length > 0) {
    const errorMsg = `Campos obrigatórios ausentes: ${missingFields.join(", ")}`;
    console.error("[FLYCONTROL] ❌ Erro de validação antes do POST:", errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Preparar Payload Final
  // Se for MESA, enviamos o payload simplificado solicitado para evitar erros de colunas extras no FlyControl
  let finalPayloadToProxy: any = payload;
  
  if (payload.order.order_type === "table") {
    finalPayloadToProxy = {
      ...payload,
      // Garante que campos que podem causar erro 500 no insert do FlyControl (como table_name) não existam
      order: {
        ...payload.order,
        // Removemos explicitamente table_id se estiver presente e puder causar confusão
        // E garantimos que table_name não seja enviado
      }
    };
    
    // O usuário solicitou um formato específico FLAT para mesa:
    // No entanto, o Proxy /api/public/submit-order espera o formato FlycontrolOrderPayload.
    // Vamos apenas garantir que não enviamos table_name.
    delete (finalPayloadToProxy.order as any).table_name;
  }

  console.log("CHECKOUT_FINAL_PAYLOAD:", JSON.stringify(finalPayloadToProxy, null, 2));
  const endpointUrl = "/api/public/submit-order";
  console.log("CHECKOUT_ENDPOINT_URL:", endpointUrl);

  const idempotencyKey = payload.order.id;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-idempotency-key": idempotencyKey,
  };

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ restaurant_id: restaurant.id, payload: finalPayloadToProxy }),
      signal: opts.signal,
    });

    const responseText = await response.text();
    const status = response.status;
    
    console.log("CHECKOUT_RESPONSE_STATUS:", status);
    console.log("CHECKOUT_RESPONSE_RAW_TEXT:", responseText);

    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Resposta do FlyControl não é JSON: ${responseText}`);
    }

    console.log("CHECKOUT_RESPONSE_JSON:", data);

    if (data?.skipped) {
      return { success: false, skipped: true, message: data.message || "Integração desativada" };
    }

    if (!response.ok || data?.success === false) {
      const errorMsg = data?.error || data?.message || `HTTP ${status}: ${responseText}`;
      console.error("CHECKOUT_SEND_ERROR:", errorMsg);
      throw new Error(errorMsg);
    }

    const orderId = data?.response?.order_id || data?.order_id || payload.order.id;
    console.log("CHECKOUT_SUCCESS_CONFIRMED", { order_id: orderId });
    return { success: true, order_id: orderId };
  } catch (err: any) {
    console.error("CHECKOUT_SEND_ERROR:", err.message);
    throw err;
  }
}

/**
 * Opens a table session in FlyControl.
 */
export async function openTableSession(
  restaurant: Pick<RestaurantRow, "id" | "slug">,
  payload: OpenTableSessionPayload
): Promise<{ success: boolean; session_id?: string; message?: string; already_open?: boolean; status?: string; closed?: boolean }> {
  console.log("OPEN_TABLE_SESSION_ONLY", { 
    restaurant_slug: payload.restaurant_slug,
    table_number: payload.table_number,
    table_token: payload.table_token
  });

  const endpointUrl = "/api/public/open-table-session";
  console.log("OPEN_TABLE_SESSION_ENDPOINT:", endpointUrl);

  try {
    // Reduzimos o payload para o mínimo necessário solicitado, sem o evento de criação de pedido
    const minimalPayload = {
      restaurant_slug: payload.restaurant_slug,
      table_number: payload.table_number,
      table_token: payload.table_token,
      opened_from: payload.opened_from || "qrcode_scan"
    };

    console.log("OPEN_TABLE_SESSION_REQUEST", minimalPayload);

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        restaurant_id: restaurant.id, 
        payload: minimalPayload
      }),
    });

    const data = await response.json();
    console.log("OPEN_TABLE_SESSION_RESPONSE:", data);

    // Extract status from any common shape returned by FlyControl
    const rawStatus = (
      data.response?.status ?? data.status ?? data.response?.session_status ?? data.session_status ?? ""
    )
      .toString()
      .toLowerCase();
    const closedSignals = /(closed|fechad|finaliz|encerr|ended)/;
    const isClosed = closedSignals.test(rawStatus);

    if (!response.ok || data.success === false) {
      console.error("OPEN_TABLE_SESSION_ERROR:", data.error || data.message || `HTTP ${response.status}`);
      return { success: false, message: data.error || data.message, status: rawStatus || undefined, closed: isClosed };
    }

    const sessionId = data.response?.session_id || data.session_id;
    if (sessionId) {
      console.log("TABLE_SESSION_ID_SAVED:", sessionId);
    }

    return {
      success: !isClosed,
      session_id: sessionId,
      already_open: data.response?.already_open || data.already_open,
      status: rawStatus || undefined,
      closed: isClosed,
      message: isClosed ? "session_closed" : undefined,
    };
  } catch (err: any) {
    console.error("OPEN_TABLE_SESSION_ERROR:", err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Non-mutating status check. Returns `{ closed: true }` when FlyControl
 * reports the session as closed/finalized. Used by the customer-side poll
 * to terminate the session without re-opening it.
 */
export async function checkTableSession(
  restaurant: Pick<RestaurantRow, "id" | "slug">,
  params: { table_token?: string | null; table_session_id?: string | null; table_number?: string | null }
): Promise<{ success: boolean; closed: boolean; status?: string | null; unavailable?: boolean }> {
  try {
    const res = await fetch("/api/public/check-table-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        table_token: params.table_token ?? null,
        table_session_id: params.table_session_id ?? null,
        table_number: params.table_number ?? null,
      }),
    });
    const data = await res.json();
    return {
      success: !!data?.success,
      closed: !!data?.closed,
      status: data?.status ?? null,
      unavailable: !!data?.unavailable,
    };
  } catch (err: any) {
    console.warn("CHECK_TABLE_SESSION_ERROR", err?.message);
    return { success: false, closed: false };
  }
}

/**
 * Sends an order to an external webhook URL via a secure edge function proxy.
 */

export async function sendOrderToExternalWebhook(
  webhookUrl: string,
  payload: FlycontrolOrderPayload,
  requireAuth: boolean = false,
  restaurantId?: string,
  source: "admin_test" | "public_checkout" = "public_checkout"
): Promise<{ success: boolean; status: number; response?: any; error?: string; headers?: any; url?: string }> {
  // Logs técnicos obrigatórios solicitados
  console.log(`--- INICIANDO CHAMADA DE WEBHOOK EXTERNO (${source.toUpperCase()}) ---`);
  console.log("URL Webhook FIQON usada:", webhookUrl);
  console.log("Payload enviado:", JSON.stringify(payload, null, 2));

  try {
    const { data, error: functionError } = await safeInvoke('send-fiqon-webhook', {
      body: { webhookUrl, payload, restaurantId }
    }, requireAuth);

    if (functionError) {
      console.error("❌ [WEBHOOK] Erro na Edge Function:", functionError);
      
      // Se houver erro de status (>= 400), o safeInvoke coloca no object 'error'
      // Precisamos tentar recuperar o máximo de info possível
      const status = functionError.status || 0;
      const errorMsg = functionError.message || `Erro HTTP ${status}`;

      // Log no banco se tivermos o ID do restaurante
      if (restaurantId) {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.from("order_submission_logs").insert({
          source,
          restaurant_id: restaurantId,
          order_id: payload.order.id,
          webhook_url: webhookUrl,
          payload: payload as any,
          status: status,
          error: `Edge Function error: ${errorMsg}`
        });
      }
      
      return {
        success: false,
        status: status,
        error: errorMsg,
        url: webhookUrl
      };
    }

    // Se chegou aqui, safeInvoke considerou sucesso (status 2xx)
    const { success, status, response: responseData, error: fiqonError, headers: responseHeaders } = data;

    console.log("Status HTTP recebido:", status);
    console.log("Resposta FIQON:", JSON.stringify(responseData, null, 2));
    
    // Log no banco de dados para cada tentativa (se não foi logado pela Edge Function)
    // A Edge Function já loga em admin_test, mas no checkout público é o frontend que loga.
    if (restaurantId && source === "public_checkout") {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.from("order_submission_logs").insert({
        source,
        restaurant_id: restaurantId,
        order_id: payload.order.id,
        webhook_url: webhookUrl,
        payload: payload as any,
        status: status || 0,
        response: responseData as any,
        error: fiqonError || null
      });
    }
    
    console.log("------------------------------------------");

    return {
      success: !!success,
      status: status || 0,
      response: responseData,
      headers: responseHeaders,
      error: fiqonError
    };
  } catch (err: any) {
    console.error("❌ [WEBHOOK] Erro fatal no envio:", err.message);
    
    // Log de erro no banco
    if (restaurantId) {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.from("order_submission_logs").insert({
          source,
          restaurant_id: restaurantId,
          order_id: payload.order.id,
          webhook_url: webhookUrl,
          payload: payload as any,
          status: 0,
          error: err.message
        });
      } catch (logErr) {
        console.error("Erro ao salvar log de erro:", logErr);
      }
    }

    console.log("------------------------------------------");
    return {
      success: false,
      status: 0,
      error: err.message,
    };
  }
}

/**
 * Shared function to send an order to FIQON with unified logging and database persistence.
 */
export async function sendUnifiedOrderToFiqon(
  orderPayload: FlycontrolOrderPayload,
  restaurant: RestaurantRow,
  source: "admin_test" | "public_checkout" = "public_checkout"
) {
  if (!FEATURES.ENABLE_FIQON_AUTOMATION) {
    console.warn("[FIQON] Tentativa de envio bloqueada: Funcionalidade desativada via Feature Flag.");
    return { success: false, status: 0, error: "Funcionalidade desativada." };
  }

  const webhookUrl = restaurant.fiqon_webhook_url || (restaurant.site_settings as any)?.external_webhook_url;
  
  if (!webhookUrl) {
    throw new Error("Webhook FIQON não configurado.");
  }

  return await sendOrderToExternalWebhook(
    webhookUrl,
    orderPayload,
    source === "admin_test", // requireAuth only for admin tests
    restaurant.id,
    source
  );
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