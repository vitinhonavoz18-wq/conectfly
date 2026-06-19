import { useState, useMemo, useRef, useEffect } from "react";
import { X, Minus, Plus, Trash2, MapPin, CreditCard, Banknote, MessageSquare, ShoppingBag, ChevronRight, ArrowLeft, Store, Utensils, Ticket, CheckCircle2, QrCode, Camera, AlertCircle, Loader2 } from "lucide-react";
import { useCart } from "./CartContext";
import { formatBRL, formatPhoneMask } from "@/lib/site/format";
import type { DeliveryZoneRow, RestaurantRow } from "@/lib/site/types";
import { buildOrderPayload, sendOrderToFlycontrol, sendOrderToExternalWebhook, sendUnifiedOrderToFiqon, resolveTablesUrl, openTableSession, type OpenTableSessionPayload } from "@/lib/site/flycontrol";
import { buildOrderMessage, buildWhatsAppMessage } from "@/lib/site/orderFormatter";
import { toast } from "sonner";
import { FEATURES } from "@/lib/features";
import { supabase } from "@/integrations/supabase/client";
import { QrScanner } from "./QrScanner";


interface Props {
  open: boolean;
  onClose: () => void;
  whatsappNumber: string;
  restaurantName: string;
  deliveryZones?: DeliveryZoneRow[];
  restaurant?: RestaurantRow;
}

export function SiteCartDrawer({ open, onClose, whatsappNumber, restaurantName, deliveryZones = [], restaurant }: Props) {
  const { items, updateQty, removeLine, totalPrice, clear, validatedTable, setValidatedTable } = useCart();
  const [step, setStep] = useState<"cart" | "checkout" | "confirmation">("cart");
  const [orderType, setOrderType] = useState<"delivery" | "pickup" | "table">("delivery");
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableToken, setTableToken] = useState<string | null>(null);
  const [tableSessionId, setTableSessionId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isOpeningTableSession, setIsOpeningTableSession] = useState(false);
  const [tableSessionOpened, setTableSessionOpened] = useState(false);
  const [lastOpenedTableToken, setLastOpenedTableToken] = useState<string | null>(null);
  const [currentTableSessionId, setCurrentTableSessionId] = useState<string | null>(null);

  const [isValidatingQr, setIsValidatingQr] = useState(false);
  const [debugQr, setDebugQr] = useState<{
    rawValue: string;
    slug: string | null;
    token: string | null;
    status: string;
    reason: string;
  } | null>(null);
  const lastInvalidQrRef = useRef<{ value: string; at: number } | null>(null);
  const qrErrorCooldownMs = 3000;
  const lastScannedQrRef = useRef<string | null>(null);
  const [finishedOrder, setFinishedOrder] = useState<any>(null);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [manualTableToken, setManualTableToken] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const zoneRef = useRef<HTMLSelectElement>(null);
  const paymentRef = useRef<HTMLSelectElement>(null);
  const changeRef = useRef<HTMLInputElement>(null);
  const fieldsContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Detect mesa parameter
  useEffect(() => {
    if (!restaurant) return;
    
    const params = new URLSearchParams(window.location.search);
    const mesa = params.get("mesa");
    const mode = params.get("mode");
    const token = params.get("table_token") || params.get("token");

    if ((mode === "table" || params.has("table_token") || params.has("token")) && token) {
      const normalizedUrlToken = token.trim();
      const storedToken = validatedTable?.token?.trim();

      // Evitar abrir novamente se já estiver aberta a mesma mesa
      if (tableSessionOpened && lastOpenedTableToken?.trim() === normalizedUrlToken) return;

      // Após refresh: se o contexto/localStorage já tem a mesa validada com o
      // mesmo token, restauramos sem chamar o FlyControl de novo (a segunda
      // chamada de open-table-session frequentemente retorna `invalid_table`).
      if (validatedTable && storedToken === normalizedUrlToken) {
        console.log("TABLE_RESTORED_FROM_STORAGE", validatedTable);
        setTableId(validatedTable.id);
        setTableNumber(validatedTable.number);
        setTableToken(validatedTable.token);
        setTableSessionId(validatedTable.sessionId || null);
        setTableSessionOpened(true);
        setLastOpenedTableToken(token);
        setCurrentTableSessionId(validatedTable.sessionId || null);
        setOrderType("table");
        // Revalidate silently against FlyControl to detect tables that were
        // closed remotely (operator finalized via FL). On explicit closure
        // signals, clear local state so the customer cannot keep ordering.
        handleValidateTable(token, null, mesa, { silent: true });
        return;
      }

      console.log("DETECTED_TABLE_PARAMS:", { token, mesa });
      handleValidateTable(token, null, mesa);
    } else if (mesa) {
      setTableNumber(mesa);
      setOrderType("table");
    }
  }, [restaurant, tableSessionOpened, lastOpenedTableToken, validatedTable]); // Re-run when restaurant is loaded or session state changes

  // Synchronize context validatedTable with local state
  useEffect(() => {
    if (validatedTable) {
      setTableId(validatedTable.id);
      setTableNumber(validatedTable.number);
      setTableToken(validatedTable.token);
      setTableSessionId(validatedTable.sessionId || null);
      
      // Update new state controls
      setTableSessionOpened(true);
      setLastOpenedTableToken(validatedTable.token);
      setCurrentTableSessionId(validatedTable.sessionId || null);

      if (validatedTable.sessionId) {
        console.log("TABLE_SESSION_ID_SAVED:", validatedTable.sessionId);
      }
      setOrderType("table");
    } else {
      // Clear if context is cleared
      setTableId(null);
      setTableNumber(null);
      setTableToken(null);
      setTableSessionId(null);
      setTableSessionOpened(false);
      setLastOpenedTableToken(null);
      setCurrentTableSessionId(null);
    }
  }, [validatedTable]);


  const extractTableQrData = (qrValue: string) => {
    console.log("QR_RAW_VALUE:", qrValue);
    if (!qrValue) return { restaurant_slug: null, table_number: null, table_token: null };

    // Limpeza inicial: espaços, quebras de linha, aspas extras, caracteres invisíveis
    let cleanedValue = qrValue.trim()
      .replace(/[\n\r]/g, "")
      .replace(/^["'](.+)["']$/, "$1");
    
    console.log("QR_CLEANED_VALUE:", cleanedValue);

    let slug = restaurant?.slug || null;
    let token = null;
    let number = null;

    // 1. JSON
    try {
      const parsed = JSON.parse(cleanedValue);
      if (parsed.table_token || parsed.token || parsed.public_token) {
        const result = {
          restaurant_slug: parsed.restaurant_slug || parsed.slug || slug,
          table_number: parsed.table_number || parsed.number || parsed.mesa || parsed.table || null,
          table_token: parsed.table_token || parsed.token || parsed.public_token
        };
        console.log("QR_EXTRACTED_DATA (JSON):", result);
        return result;
      }
    } catch {
      // Not a JSON
    }

    // 2. URL parsing
    try {
      // Tenta tratar como URL se contiver http ou se parecer um path
      const isUrl = cleanedValue.startsWith('http') || cleanedValue.includes('?');
      const urlStr = isUrl ? cleanedValue : `https://dummy.com/${cleanedValue.startsWith('/') ? cleanedValue.substring(1) : cleanedValue}`;
      const url = new URL(urlStr);
      
      console.log("QR_PARSING_URL:", url.toString());

      // Extrair slug da URL se for conectfly.com.br/SLUG
      if (url.hostname.includes("conectfly.com.br") || url.hostname === "localhost") {
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length > 0 && !["mesa", "table", "m"].includes(pathParts[0].toLowerCase())) {
          slug = pathParts[0];
        }
      }

      // Extrair token
      token = url.searchParams.get("table_token") || 
              url.searchParams.get("token") || 
              url.searchParams.get("public_token");
      
      // Extrair número da mesa
      number = url.searchParams.get("table_number") || 
               url.searchParams.get("mesa") || 
               url.searchParams.get("table") ||
               url.searchParams.get("m");

      // Caso B: /mesa/TOKEN ou /table/TOKEN ou /SLUG/mesa/TOKEN (se token não veio via query)
      if (!token) {
        const paths = url.pathname.split("/").filter(Boolean);
        const mesaIdx = paths.findIndex(p => ["mesa", "table", "m"].includes(p.toLowerCase()));
        if (mesaIdx !== -1 && paths[mesaIdx + 1]) {
          token = paths[mesaIdx + 1];
        }
      }
    } catch (e) {
      console.warn("QR_PARSING_URL_ERROR:", e);
    }

    // 3. Token puro (se ainda não achou nada)
    if (!token && !cleanedValue.includes("?") && !cleanedValue.includes("/")) {
      token = cleanedValue;
    }

    const result = { 
      restaurant_slug: slug, 
      table_number: number,
      table_token: token?.trim() || null 
    };
    
    console.log("QR_EXTRACTED_DATA:", result);
    return result;
  };

  const handleValidateTable = async (token: string, slugFromQr?: string | null, numberFromQr?: string | null) => {
    if (!restaurant) return false;
    
    // TRAVAS DE SEGURANÇA (Conforme solicitado)
    if (isOpeningTableSession) {
      console.log("OPEN_TABLE_SESSION_SKIPPED_ALREADY_OPENING");
      return false;
    }
    if (tableSessionOpened && lastOpenedTableToken === token) {
      console.log("OPEN_TABLE_SESSION_SKIPPED_ALREADY_OPENED");
      return false;
    }

    const targetSlug = (slugFromQr || restaurant.slug)?.trim();
    if (!targetSlug) return false;

    console.log("QR_TABLE_IDENTIFIED", { table_number: numberFromQr, table_token: token, restaurant_slug: targetSlug });
    console.log("OPEN_TABLE_SESSION_ONLY", { table_number: numberFromQr, table_token: token });

    setIsValidatingQr(true);
    setIsOpeningTableSession(true);

    try {
      // 1. Tentar abrir a sessão imediatamente
      const sessionPayload: OpenTableSessionPayload = {
        type: "open_table_session",
        restaurant_slug: targetSlug,
        order_type: "table",
        service_mode: "mesa",
        table_number: numberFromQr || "N/A", 
        table_token: token,
        customer_name: name || undefined,
        customer_phone: phone || undefined,
        opened_from: "qrcode_scan",
        opened_at: new Date().toISOString()
      };

      console.log("NO_ORDER_CREATED_ON_SCAN");
      const sessionResult = await openTableSession(restaurant, sessionPayload);

      console.log("OPEN_TABLE_SESSION_RESPONSE", sessionResult);

      if (sessionResult.success) {
        const tableData = {
          id: "flycontrol-table",
          number: numberFromQr || "Mesa", 
          token: token,
          sessionId: sessionResult.session_id
        };

        setValidatedTable(tableData);
        setTableId("flycontrol-table");
        setTableNumber(tableData.number);
        setTableToken(token);
        setTableSessionId(sessionResult.session_id || null);
        
        // Atualizar travas e IDs
        setTableSessionOpened(true);
        setLastOpenedTableToken(token);
        setCurrentTableSessionId(sessionResult.session_id || null);
        
        if (sessionResult.session_id) {
          console.log("TABLE_SESSION_ID_SAVED:", sessionResult.session_id);
        }

        setOrderType("table");

        if (sessionResult.already_open) {
          toast.success(`Mesa ${tableData.number} já está aberta.`, { id: "qr-success" });
        } else {
          toast.success(`Mesa ${tableData.number} aberta com sucesso!`, { id: "qr-success" });
        }
        
        setIsScanning(false);
        return true;
      } else {
        // Fallback: se já temos uma mesa validada armazenada com o mesmo token,
        // restauramos do storage em vez de mostrar o erro bruto do FlyControl
        // (ex.: "invalid_table" quando a sessão já estava aberta).
        const stored = validatedTable;
        if (stored && stored.token?.trim() === token.trim()) {
          console.log("TABLE_RESTORED_FROM_STORAGE_AFTER_FAILURE", stored);
          setTableId(stored.id);
          setTableNumber(stored.number);
          setTableToken(stored.token);
          setTableSessionId(stored.sessionId || null);
          setTableSessionOpened(true);
          setLastOpenedTableToken(stored.token);
          setCurrentTableSessionId(stored.sessionId || null);
          setOrderType("table");
          setIsScanning(false);
          return true;
        }

        // Nunca mostrar códigos brutos do FlyControl (ex.: "invalid_table") ao cliente.
        const raw = (sessionResult.message || "").toString().toLowerCase();
        const isRawCode = /^[a-z_]+$/.test(raw);
        const errorMsg = !raw || isRawCode
          ? "Não foi possível identificar a mesa. Procure um atendente."
          : sessionResult.message!;
        toast.error(errorMsg, { id: "qr-error" });
        return false;
      }
    } catch (err: any) {
      console.error("QR_VALIDATE_ERROR:", err);
      toast.error("Falha ao sincronizar mesa. Procure um atendente.", { id: "qr-error" });
      return false;
    } finally {
      setIsValidatingQr(false);
      setIsOpeningTableSession(false);
    }
  };


  const onQrScan = async (text: string) => {
    // 1. Verificações iniciais e bloqueio de múltiplas leituras
    if (!text || isValidatingQr || isOpeningTableSession || !isScanning) return;
    
    // Se já estiver aberta a mesma mesa, não faz nada
    const { table_token: extractedToken } = extractTableQrData(text);
    if (tableSessionOpened && lastOpenedTableToken === extractedToken) {
      console.log("QR_TABLE_SCANNED: Already opened this table, skipping.");
      return;
    }

    // 2. Pausar scanner imediatamente ao detectar um QR
    console.log("QR_TABLE_SCANNED", text);
    setIsScanning(false); // Fecha o modal do scanner
    
    const now = Date.now();
    if (text === lastInvalidQrRef.current?.value && (now - lastInvalidQrRef.current.at < qrErrorCooldownMs)) {
      return;
    }

    const { restaurant_slug, table_token, table_number } = extractTableQrData(text);

    setDebugQr({
      rawValue: text,
      slug: restaurant_slug,
      token: table_token,
      status: "Validando...",
      reason: ""
    });

    if (!table_token) {
      if (text !== lastInvalidQrRef.current?.value || (now - lastInvalidQrRef.current.at > qrErrorCooldownMs)) {
        toast.error("QR Code de mesa inválido. Procure um atendente.", { id: "qr-error" });
        lastInvalidQrRef.current = { value: text, at: now };
      }
      // Reabre o scanner se for inválido? Geralmente sim, mas o usuário quer "pausar imediatamente"
      // Vamos manter pausado e deixar o usuário clicar em escanear novamente se quiser
      return;
    }

    const success = await handleValidateTable(table_token, restaurant_slug, table_number);
    
    if (!success) {
      lastInvalidQrRef.current = { value: text, at: now };
      // Opcional: Reabrir scanner em caso de erro não crítico? 
      // O usuário disse "bloquear novas leituras", então mantemos fechado.
    } else {
      lastInvalidQrRef.current = null;
    }
  };

  const handleManualTest = async () => {
    if (!manualTableToken.trim()) return;
    
    console.log("QR_MANUAL_TEST_STARTED:", manualTableToken);
    const { restaurant_slug, table_token } = extractTableQrData(manualTableToken);
    
    if (!table_token) {
      toast.error("Formato inválido. Insira a URL completa ou o token.");
      return;
    }

    await handleValidateTable(table_token, restaurant_slug);
  };

  // Default mode selection if only one is active
  useEffect(() => {
    if (restaurant && step === "checkout") {
      const activeModes = [];
      // Use delivery_enabled from restaurant object
      if (restaurant.delivery_enabled !== false) activeModes.push("delivery");
      if (restaurant.pickup_enabled) activeModes.push("pickup");
      if (restaurant.table_enabled) activeModes.push("table");

      console.log("CHECKOUT_SERVICE_MODES_RENDERED:", activeModes);

      // Auto select if only one mode and not already forced by mesa param
      if (activeModes.length === 1 && !tableNumber) {
        console.log("CHECKOUT_SERVICE_MODE_AUTO_SELECTED:", activeModes[0]);
        setOrderType(activeModes[0] as any);
      }
    }
  }, [restaurant, step, tableNumber]);

  // Reset step when closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("cart");
        setFinishedOrder(null);
      }, 500);
    }
  }, [open]);

  // Scroll to top when changing steps
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [step]);

  const selectedZone = deliveryZones.find((z) => z.id === zoneId) ?? null;
  const isDelivery = orderType === "delivery";
  const deliveryFee = isDelivery ? Number(selectedZone?.fee ?? 0) : 0;
  const grandTotal = totalPrice + deliveryFee;
  const hasZones = deliveryZones.length > 0;

   const flycontrolOn = useMemo(() => !!restaurant?.flycontrol_enabled, [restaurant?.flycontrol_enabled]);
   const whatsappOn = useMemo(() => restaurant?.whatsapp_enabled !== false, [restaurant?.whatsapp_enabled]);
 
   const openWhatsAppOrder = (message: string) => {
     if (!whatsappNumber) return;
     const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
     
     // Try window.open first, fallback to location.href if blocked
     const opened = window.open(url, "_blank");
     if (!opened || opened.closed || typeof opened.closed === "undefined") {
       window.location.href = url;
     }
   };

  const goToCheckout = () => {
    if (items.length === 0) {
      setError("Seu carrinho está vazio");
      return;
    }
    setError("");
    setStep("checkout");
  };

  const handleFinish = async () => {
    console.log("CHECKOUT_SUBMIT_STARTED");
    setError("");
    setValidationAttempted(true);

    let firstEmptyField: React.RefObject<HTMLElement | null> | null = null;
    let errorMessage = "";

    if (!name.trim()) {
      firstEmptyField = nameRef;
      errorMessage = "Por favor, preencha seu nome";
    } else if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
      firstEmptyField = phoneRef;
      errorMessage = "Por favor, preencha um telefone válido";
    } else if (orderType === "delivery") {
      if (hasZones && !selectedZone) {
        firstEmptyField = zoneRef;
        errorMessage = "Selecione o bairro para entrega";
      } else if (!address.trim()) {
        firstEmptyField = addressRef;
        errorMessage = "Informe o seu endereço completo";
      }
    } else if (orderType === "table") {
      if (!tableNumber) {
        errorMessage = "O número da mesa não foi identificado.";
      } else if (!tableToken) {
        errorMessage = "O token de validação da mesa está ausente. Escaneie o QR Code novamente.";
      }
    } else if (!paymentMethod) {
      firstEmptyField = paymentRef;
      errorMessage = "Selecione uma forma de pagamento";
    } else if (paymentMethod === "Dinheiro" && !changeFor.trim()) {
      firstEmptyField = changeRef;
      errorMessage = "Informe se precisa de troco";
    }

    if (errorMessage) {
      setError(errorMessage);
      if (firstEmptyField && firstEmptyField.current) {
        firstEmptyField.current?.focus();
        firstEmptyField.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (items.length === 0) {
      setError("Seu carrinho está vazio");
      return;
    }

    if (totalPrice <= 0) {
      setError("O total do pedido deve ser maior que zero");
      return;
    }

    if (!restaurant?.slug) {
      setError("Erro interno: restaurante não identificado");
      return;
    }

    if (whatsappOn && !whatsappNumber && !flycontrolOn) {
      setError("Loja sem WhatsApp configurado");
      return;
    }

    // Generate ticket number for pickup if not exists
    let generatedTicket = ticketNumber;
    if (orderType === "pickup" && !generatedTicket) {
      generatedTicket = Math.floor(1000 + Math.random() * 9000).toString();
      setTicketNumber(generatedTicket);
    }

    console.log("CHECKOUT_ITEMS_COUNT:", items.length);
    console.log("CHECKOUT_TOTAL:", grandTotal);
    console.log("CHECKOUT_ORDER_TYPE:", orderType);
    console.log("CHECKOUT_SERVICE_MODE:", orderType === "table" ? "mesa" : (orderType === "pickup" ? "retirada" : "delivery"));
    
    const orderData = {
      customer: {
        name,
        phone,
        address: orderType === "delivery" ? address : (orderType === "table" ? `Mesa ${tableNumber}` : "Retirada no Balcão"),
        neighborhood: orderType === "delivery" ? (selectedZone?.neighborhood || null) : null,
      },
      items,
      subtotal: totalPrice,
      deliveryFee,
      total: grandTotal,
      paymentMethod,
      changeFor: changeFor ? parseFloat(changeFor.replace(",", ".")) : null,
      notes,
      createdAt: new Date().toISOString(),
      order_type: orderType,
      service_mode: orderType === "table" ? "mesa" : (orderType === "pickup" ? "retirada" : "delivery"),
      table_number: orderType === "table" ? tableNumber : null,
      table_id: orderType === "table" ? tableId : null,
      table_token: orderType === "table" ? tableToken : null,
      table_session_id: orderType === "table" ? tableSessionId : null,
      ticket_number: generatedTicket,
    };

    const messageWhatsApp = buildWhatsAppMessage(orderData);
    
    setSending(true);
    let success = false;
    const siteSettings = restaurant?.site_settings as any;
    
    let flowMode = restaurant?.order_flow_mode || siteSettings?.order_flow_mode || (restaurant?.fiqon_webhook_url || siteSettings?.external_webhook_url ? "fiqon" : "direct");
    
    if (!FEATURES.ENABLE_FIQON_AUTOMATION && flowMode === "fiqon") {
      flowMode = "direct";
    }

    // CRÍTICO: pedidos de Mesa e Retirada SEMPRE precisam de confirmação real do FlyControl.
    // O modo "whatsapp" só é válido para Delivery. Sem essa regra, mesa/retirada mostravam
    // "sucesso" sem o pedido chegar ao painel (bug observado no HSBOTECO).
    const requiresBackend = orderType === "table" || orderType === "pickup";
    if (requiresBackend) {
      if (!flycontrolOn) {
        setSending(false);
        const msg = "Esta loja não está conectada ao painel. Pedidos de mesa/retirada não podem ser confirmados no momento.";
        setError(msg);
        toast.error(msg);
        return;
      }
      // Força envio direto ao FlyControl para mesa/retirada
      if (flowMode === "whatsapp") flowMode = "direct";
    }

    const allowDoubleSend = restaurant?.allow_dual_send ?? !!siteSettings?.allow_double_send;
    const externalWebhookUrl = restaurant?.fiqon_webhook_url || siteSettings?.external_webhook_url;
    const whatsappEnabled = restaurant?.continue_opening_whatsapp ?? (restaurant?.whatsapp_enabled !== false);

    console.log("CHECKOUT_FETCH_STARTED");

    try {
      const orderPayload = buildOrderPayload({
        name,
        phone,
        address: orderData.customer.address,
        neighborhood: orderData.customer.neighborhood,
        reference: null,
        deliveryFee,
        items,
        subtotal: totalPrice,
        total: grandTotal,
        paymentMethod,
        changeFor: orderData.changeFor,
        notes: notes.trim(),
        pizzeria_slug: restaurant?.slug || "",
        pizzeria_name: restaurant?.name || "",
        whatsapp_message: messageWhatsApp,
        order_type: orderType,
        service_mode: orderType === "table" ? "mesa" : (orderType === "pickup" ? "retirada" : "delivery"),
        table_number: orderData.table_number,
        table_id: orderData.table_id,
        table_token: orderData.table_token,
        table_session_id: orderData.table_session_id,
        ticket_number: orderData.ticket_number,
      });

      console.log("CHECKOUT_FINAL_PAYLOAD:", JSON.stringify(orderPayload, null, 2));

      // 1. Envio para FIQON (Webhook Externo)
      if (FEATURES.ENABLE_FIQON_AUTOMATION && (flowMode === "fiqon" || (allowDoubleSend && flowMode !== "whatsapp"))) {
        if (externalWebhookUrl) {
          try {
            const result = await sendUnifiedOrderToFiqon(orderPayload, restaurant as any, "public_checkout");
            console.log("CHECKOUT_RESPONSE_STATUS (FIQON):", result.status);
            console.log("CHECKOUT_RESPONSE_JSON (FIQON):", result);

            if (result.success) {
              success = true;
            } else if (flowMode === "fiqon") {
              throw new Error(`Erro no FIQON (${result.status}): ${result.error || 'Falha no envio'}`);
            }
          } catch (webhookErr: any) {
            console.error("CHECKOUT_SEND_ERROR (FIQON):", webhookErr);
            if (flowMode === "fiqon") {
              throw webhookErr;
            }
          }
        }
      }

      // 2. Envio Direto para FlyControl
      if (flycontrolOn && restaurant && (flowMode === "direct" || requiresBackend || (allowDoubleSend && !success))) {
        try {
          const result = await sendOrderToFlycontrol(restaurant, orderPayload);
          console.log("CHECKOUT_RESPONSE_JSON (FLYCONTROL):", result);
          
          if (result.success) {
            success = true;
            console.log("CHECKOUT_SUCCESS_CONFIRMED");
          } else {
            throw new Error(result.message || "FlyControl retornou success false");
          }
        } catch (err: any) {
          console.error("CHECKOUT_SEND_ERROR (FLYCONTROL):", err);
          throw err;
        }
      }

      // Mesa/Retirada exigem sucesso real do backend. Delivery ainda pode usar modo WhatsApp puro.
      const canShowSuccess = success || (flowMode === "whatsapp" && !requiresBackend);
      if (canShowSuccess) {
        if (orderType === "table") {
          toast.success(`Pedido enviado com sucesso para a Mesa ${tableNumber}.`);
        } else {
          toast.success("Pedido confirmado com sucesso!");
        }
        
        // Redirecionar para WhatsApp APÓS o envio (SOMENTE PARA DELIVERY E SE NÃO FOR MESA)
        if (whatsappEnabled && orderType === "delivery") {
          openWhatsAppOrder(messageWhatsApp);
        }

        // Limpar carrinho e encerrar apenas APÓS confirmação
        clear();
        
        if (orderType === "pickup" || orderType === "table") {
          setFinishedOrder(orderData);
          setStep("confirmation");
        } else {
          setName("");
          setPhone("");
          setAddress("");
          setPaymentMethod("PIX");
          setChangeFor("");
          setNotes("");
          setZoneId("");
          onClose();
        }
      } else {
        throw new Error("Não foi possível confirmar o recebimento do pedido pelo painel.");
      }

    } catch (err: any) {
      console.error("CHECKOUT_SEND_ERROR:", err);
      const errorMsg = "Não foi possível enviar seu pedido para o painel. Tente novamente ou procure um atendente.";
      
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSending(false);
      console.log("CHECKOUT_FLOW_FINISHED");
    }
  };


  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-50 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
       <aside
          className={`fixed top-0 right-0 bottom-0 w-full max-w-md z-50 bg-[hsl(var(--site-card))] shadow-[0_0_80px_rgba(0,0,0,0.15)] flex flex-col transition-transform duration-500 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--site-border))]">
            <div className="flex items-center gap-3">
              {step === "checkout" && (
                <button
                  onClick={() => setStep("cart")}
                  className="p-2 -ml-2 rounded-xl hover:bg-[hsl(var(--site-bg))] text-[hsl(var(--site-muted-fg))] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex flex-col">
                <h2 className="font-black text-lg tracking-tighter uppercase text-[hsl(var(--site-fg))]">
                  {step === "cart" ? "Minha Seleção" : (step === "checkout" ? "Finalizar Pedido" : "Pedido Confirmado")}
                </h2>
                <span className="text-[8px] text-[hsl(var(--site-primary))] font-black uppercase tracking-[0.2em]">
                  {step === "cart" ? "Revise seus itens" : (step === "checkout" ? "Dados de Entrega" : "Sucesso")}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl site-btn-secondary active:scale-90"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain bg-[hsl(var(--site-bg))] scroll-smooth"
          >
            {step === "cart" ? (
              <div className="p-4 space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
                {items.length === 0 ? (
                  <div className="text-center py-16 flex flex-col items-center gap-4">
                    <ShoppingBag className="h-14 w-14 text-[hsl(var(--site-border))]" />
                    <p className="text-[hsl(var(--site-muted-fg))] font-medium text-sm">
                      Seu carrinho está vazio.<br/>Adicione itens do cardápio.
                    </p>
                  </div>
                ) : (
                  items.map((l) => (
                    // ... item rendering remains same
                    <div
                      key={`${l.itemId}-${l.sizeLabel ?? ""}`}
                      className="rounded-[1.5rem] border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] p-4 relative overflow-hidden group shadow-sm transition-all"
                    >
                      <div className="flex justify-between gap-3">
                        <div className="flex-1 relative z-10">
                          <p className="font-black text-sm tracking-tight uppercase text-[hsl(var(--site-fg))]">
                            {l.name}
                            {l.sizeLabel ? <span className="text-[9px] text-[hsl(var(--site-primary))] ml-2 font-black bg-[hsl(var(--site-primary)/0.1)] px-1.5 py-0.5 rounded border border-[hsl(var(--site-primary)/0.2)]">({l.sizeLabel})</span> : ""}
                          </p>
                          {l.flavors && l.flavors.length > 0 ? (
                            <p className="text-xs text-[hsl(var(--site-muted-fg))] mt-1 leading-relaxed font-medium">
                              Sabores: {l.flavors.join(" + ")}
                            </p>
                          ) : l.description ? (
                            <p className="text-xs text-[hsl(var(--site-muted-fg))] mt-1 leading-relaxed line-clamp-2">
                              {l.description}
                            </p>
                          ) : null}
                        </div>
                        <button
                          onClick={() => removeLine(l.itemId, l.sizeLabel)}
                          className="p-2 text-[hsl(var(--site-muted-fg))] hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <div className="flex items-center gap-2 bg-[hsl(var(--site-bg))] p-1 rounded-xl border border-[hsl(var(--site-border))]">
                          <button
                            onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity - 1)}
                            className="h-7 w-7 site-btn-secondary !rounded-lg active:scale-90 flex items-center justify-center"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center font-black text-base text-[hsl(var(--site-fg))]">{l.quantity}</span>
                          <button
                            onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity + 1)}
                            className="h-7 w-7 site-btn-primary !rounded-lg active:scale-90 flex items-center justify-center"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="font-black text-lg text-[hsl(var(--site-fg))] tracking-tighter">
                          {formatBRL(l.unitPrice * l.quantity)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : step === "checkout" ? (
              <div className="p-4 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300" ref={fieldsContainerRef}>
                {/* Seleção de Modo de Atendimento */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--site-secondary))] flex items-center gap-2 mb-1">
                    <span className="h-0.5 w-6 bg-[hsl(var(--site-secondary))] rounded-full"></span>
                    Como prefere seu pedido?
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {restaurant?.delivery_enabled !== false && (
                      <button
                        onClick={() => setOrderType("delivery")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${orderType === 'delivery' ? 'bg-[hsl(var(--site-primary)/0.1)] border-[hsl(var(--site-primary))] text-[hsl(var(--site-primary))]' : 'bg-[hsl(var(--site-card))] border-[hsl(var(--site-border))] text-[hsl(var(--site-muted-fg))]'}`}
                      >
                        <MapPin className="h-5 w-5" />
                        <span className="text-[10px] font-black uppercase tracking-tight">Delivery</span>
                      </button>
                    )}
                    {restaurant?.pickup_enabled && (
                      <button
                        onClick={() => setOrderType("pickup")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${orderType === 'pickup' ? 'bg-[hsl(var(--site-primary)/0.1)] border-[hsl(var(--site-primary))] text-[hsl(var(--site-primary))]' : 'bg-[hsl(var(--site-card))] border-[hsl(var(--site-border))] text-[hsl(var(--site-muted-fg))]'}`}
                      >
                        <Store className="h-5 w-5" />
                        <span className="text-[10px] font-black uppercase tracking-tight">Retirada</span>
                      </button>
                    )}
                    {(restaurant?.table_enabled || tableNumber) && (
                      <button
                        onClick={() => {
                          setOrderType("table");
                          if (!tableId && !tableNumber) {
                            setIsScanning(true);
                          }
                        }}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${orderType === 'table' ? 'bg-[hsl(var(--site-primary)/0.1)] border-[hsl(var(--site-primary))] text-[hsl(var(--site-primary))]' : 'bg-[hsl(var(--site-card))] border-[hsl(var(--site-border))] text-[hsl(var(--site-muted-fg))]'}`}
                      >
                        <Utensils className="h-5 w-5" />
                        <span className="text-[10px] font-black uppercase tracking-tight">
                          {restaurant?.selected_template === 'bar_prime' ? 'Pedir na Mesa' : 'Mesa'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Identificação de Mesa */}
                {orderType === "table" && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--site-secondary))] flex items-center gap-2 mb-1">
                      <span className="h-0.5 w-6 bg-[hsl(var(--site-secondary))] rounded-full"></span>
                      Sua Mesa
                    </h3>
                    
                    {!tableId ? (
                      <div className="p-6 rounded-[2rem] border-2 border-dashed border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] flex flex-col items-center gap-4 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--site-primary)/0.1)] flex items-center justify-center">
                          <QrCode className="h-7 w-7 text-[hsl(var(--site-primary))]" />
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-tight text-[hsl(var(--site-fg))]">Escaneie o QR Code da Mesa</p>
                          <p className="text-[10px] text-[hsl(var(--site-muted-fg))] font-medium uppercase tracking-widest mt-1">Obrigatório para pedidos locais</p>
                        </div>
                        <button
                          onClick={() => setIsScanning(true)}
                          disabled={isValidatingQr}
                          className="w-full btn-premium py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl"
                        >
                          {isValidatingQr ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                          <span className="uppercase text-xs font-black tracking-widest">Ler QR Code</span>
                        </button>
                        {/* Testar token manualmente (Debug/Admin) */}
                        <div className="w-full pt-4 border-t border-[hsl(var(--site-border))/0.5] mt-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-[hsl(var(--site-muted-fg))] mb-2">Testar token manualmente (Debug)</p>
                          <div className="flex gap-2">
                            <input 
                              value={manualTableToken}
                              onChange={(e) => setManualTableToken(e.target.value)}
                              placeholder="URL ou Token"
                              className="flex-1 px-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] text-[10px] font-bold focus:outline-none focus:border-[hsl(var(--site-primary))]"
                            />
                            <button 
                              onClick={handleManualTest}
                              disabled={isValidatingQr}
                              className="px-4 py-2 bg-[hsl(var(--site-primary)/0.1)] text-[hsl(var(--site-primary))] rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[hsl(var(--site-primary)/0.2)] transition-all"
                            >
                              {isValidatingQr ? <Loader2 className="h-3 w-3 animate-spin" /> : "Validar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 rounded-[2rem] border-2 border-[hsl(var(--site-primary)/0.3)] bg-[hsl(var(--site-primary)/0.05)] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--site-primary))] flex items-center justify-center text-white shadow-glow">
                            <span className="font-black text-2xl tracking-tighter">{tableNumber}</span>
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--site-primary))] mb-0.5">Mesa {tableNumber} identificada</p>
                             <h4 className="text-xl font-black uppercase tracking-tight text-[hsl(var(--site-fg))]">Mesa {tableNumber}</h4>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setValidatedTable(null);
                          }}
                          className="p-3 rounded-xl hover:bg-[hsl(var(--site-primary)/0.1)] text-[hsl(var(--site-muted-fg))] hover:text-[hsl(var(--site-primary))] transition-all"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Bloco 1 — Dados do cliente */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--site-secondary))] flex items-center gap-2 mb-1">
                    <span className="h-0.5 w-6 bg-[hsl(var(--site-secondary))] rounded-full"></span>
                    Seus Dados
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome completo"
                      className={`w-full px-4 py-3 rounded-xl bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] transition-all font-bold focus:outline-none text-sm text-[hsl(var(--site-fg))] placeholder:text-[hsl(var(--site-muted-fg))] ${
                        validationAttempted && !name.trim() ? "ring-2 ring-[hsl(var(--site-danger)/0.3)] border-[hsl(var(--site-danger)/0.5)]" : "focus:border-[hsl(var(--site-primary)/0.5)]"
                      }`}
                    />
                    <input
                      ref={phoneRef}
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                      placeholder="WhatsApp"
                      inputMode="numeric"
                      className={`w-full px-4 py-3 rounded-xl bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] transition-all font-bold focus:outline-none text-sm text-[hsl(var(--site-fg))] placeholder:text-[hsl(var(--site-muted-fg))] ${
                        validationAttempted && (!phone.trim() || phone.replace(/\D/g, "").length < 10) ? "ring-2 ring-[hsl(var(--site-danger)/0.3)] border-[hsl(var(--site-danger)/0.5)]" : "focus:border-[hsl(var(--site-primary)/0.5)]"
                      }`}
                    />
                  </div>
                </div>

                {/* Bloco 2 — Entrega */}
                {orderType === "delivery" && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--site-secondary))] flex items-center gap-2">
                      <span className="h-0.5 w-6 bg-[hsl(var(--site-secondary))] rounded-full"></span>
                      Entrega
                    </h3>
                    <div className="grid gap-2">
                      {hasZones && (
                        <div className="relative group">
                          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--site-primary))]" />
                          <select
                            ref={zoneRef}
                            value={zoneId}
                            onChange={(e) => setZoneId(e.target.value)}
                            className={`w-full pl-10 pr-8 py-3 rounded-xl bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] transition-all font-bold text-xs uppercase tracking-wider appearance-none focus:outline-none text-[hsl(var(--site-fg))] ${
                              validationAttempted && !selectedZone ? "ring-2 ring-[hsl(var(--site-danger)/0.3)] border-[hsl(var(--site-danger)/0.5)]" : "focus:border-[hsl(var(--site-primary)/0.5)]"
                            }`}
                          >
                            <option value="">Selecione o Bairro *</option>
                            {deliveryZones.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.neighborhood} (+{formatBRL(Number(z.fee) || 0)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <textarea
                        ref={addressRef}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Endereço (Rua, nº, complemento/referência)"
                        rows={2}
                        className={`w-full px-4 py-3 rounded-xl bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] transition-all font-bold focus:outline-none text-sm text-[hsl(var(--site-fg))] placeholder:text-[hsl(var(--site-muted-fg))] resize-none ${
                          validationAttempted && !address.trim() ? "ring-2 ring-[hsl(var(--site-danger)/0.3)] border-[hsl(var(--site-danger)/0.5)]" : "focus:border-[hsl(var(--site-primary)/0.5)]"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Bloco 3 — Pagamento */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--site-secondary))] flex items-center gap-2">
                    <span className="h-0.5 w-6 bg-[hsl(var(--site-secondary))] rounded-full"></span>
                    Pagamento
                  </h3>
                  <div className="grid gap-2">
                    <div className="relative group">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--site-muted-fg))]" />
                      <select
                        ref={paymentRef}
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className={`w-full pl-10 pr-8 py-3 rounded-xl bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] transition-all font-bold text-xs uppercase tracking-wider appearance-none focus:outline-none text-[hsl(var(--site-fg))] ${
                          validationAttempted && !paymentMethod ? "ring-2 ring-[hsl(var(--site-danger)/0.3)] border-[hsl(var(--site-danger)/0.5)]" : "focus:border-[hsl(var(--site-primary)/0.5)]"
                        }`}
                      >
                        <option value="PIX">PIX (Mais rápido)</option>
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                        <option value="Dinheiro">Dinheiro</option>
                      </select>
                    </div>

                    {paymentMethod === "Dinheiro" && (
                      <div className="relative animate-in zoom-in-95 duration-200">
                        <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--site-muted-fg))]" />
                        <input
                          ref={changeRef}
                          value={changeFor}
                          onChange={(e) => setChangeFor(e.target.value)}
                          placeholder="Troco para quanto?"
                          inputMode="numeric"
                          className={`w-full pl-10 pr-4 py-3 rounded-xl bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] transition-all font-bold focus:outline-none text-sm text-[hsl(var(--site-fg))] placeholder:text-[hsl(var(--site-muted-fg))] ${
                            validationAttempted && !changeFor.trim() ? "ring-2 ring-[hsl(var(--site-danger)/0.3)] border-[hsl(var(--site-danger)/0.5)]" : "focus:border-[hsl(var(--site-primary)/0.5)]"
                          }`}
                        />
                      </div>
                    )}

                    <div className="relative">
                      <MessageSquare className="absolute left-3.5 top-4 h-4 w-4 text-[hsl(var(--site-muted-fg))]" />
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Observações (opcional)"
                        rows={1}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] transition-all font-bold focus:outline-none focus:border-[hsl(var(--site-primary)/0.5)] text-sm text-[hsl(var(--site-fg))] placeholder:text-[hsl(var(--site-muted-fg))] resize-none"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-[hsl(var(--site-danger)/0.1)] border border-[hsl(var(--site-danger)/0.2)] rounded-xl animate-in shake duration-300">
                    <p className="text-[11px] font-black text-[hsl(var(--site-danger))] text-center uppercase tracking-wider">
                      {error}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-6" />
                <h3 className="text-xl font-black uppercase tracking-tight mb-2">Pedido Recebido!</h3>
                
                {orderType === "pickup" && (
                   <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 w-full mb-6">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-1">Número da Ficha</p>
                     <p className="text-4xl font-black text-emerald-700 mb-4">#{ticketNumber}</p>
                     <p className="text-sm font-medium text-emerald-800 leading-relaxed px-2">
                       Apresente esta ficha no balcão para retirada/pagamento.
                     </p>
                   </div>
                )}
                
                {orderType === "table" && (
                   <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 w-full mb-6">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-1">Mesa</p>
                     <p className="text-4xl font-black text-emerald-700 mb-4">{tableNumber}</p>
                     <p className="text-sm font-medium text-emerald-800 leading-relaxed px-2">
                       Pedido enviado com sucesso! Aguarde o preparo.
                     </p>
                   </div>
                )}
                
                {orderType === "delivery" && (
                  <p className="text-sm text-[hsl(var(--site-muted-fg))] mb-6">Seu pedido foi enviado e você será redirecionado para o WhatsApp.</p>
                )}
                
                {orderType === "table" && (
                  <p className="text-sm text-[hsl(var(--site-muted-fg))] mb-6 font-bold text-[hsl(var(--site-primary))]">
                    Pedido enviado com sucesso para a Mesa {tableNumber}.
                  </p>
                )}

                {orderType !== "pickup" && orderType !== "table" && orderType !== "delivery" && (
                   <p className="text-sm text-[hsl(var(--site-muted-fg))]">Aguarde seu pedido ser preparado.</p>
                )}
                
                <button onClick={onClose} className="mt-4 site-btn-primary w-full py-3">Fechar</button>
              </div>
            )}
            </div>


          {step !== "confirmation" && (
            <div className="p-4 border-t border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] sticky bottom-0 mt-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end px-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[hsl(var(--site-muted-fg))] uppercase tracking-widest">
                      {step === "cart" ? "Subtotal" : "Total a Pagar"}
                    </span>
                    <span className="text-3xl font-black text-[hsl(var(--site-primary))] tracking-tighter">
                      {formatBRL(step === "cart" ? totalPrice : grandTotal)}
                    </span>
                  </div>
                  {step === "cart" && hasZones && (
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[10px] font-bold text-[hsl(var(--site-muted-fg))] uppercase tracking-widest">Logística</span>
                      <span className="text-sm font-black text-[hsl(var(--site-fg))]">sob consulta</span>
                    </div>
                  )}
                  {step === "checkout" && orderType === "delivery" && hasZones && selectedZone && (
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[10px] font-bold text-[hsl(var(--site-muted-fg))] uppercase tracking-widest">Frete ({selectedZone.neighborhood})</span>
                      <span className="text-sm font-black text-[hsl(var(--site-fg))]">{formatBRL(deliveryFee)}</span>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={step === "cart" ? goToCheckout : handleFinish}
                  disabled={sending || (step === "cart" && items.length === 0)}
                  className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 group uppercase tracking-widest font-black text-sm transition-all active:scale-95 ${
                    step === "cart" 
                      ? "site-btn-primary" 
                      : "site-btn-success"
                  } ${sending || (step === "cart" && items.length === 0) ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {sending ? (
                    <span className="animate-pulse">
                      ENVIANDO PEDIDO PARA O PAINEL...
                    </span>
                  ) : (
                    <>
                      <span>
                        {step === "cart" 
                          ? "Próximo Passo" 
                          : (orderType === "table" && restaurant?.selected_template === 'bar_prime' 
                             ? `Pedir na Mesa ${tableNumber}` 
                             : "Finalizar Pedido")}
                      </span>
                      {step === "cart" ? (
                        <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      ) : (
                        <ShoppingBag className="h-5 w-5" />
                      )}
                    </>
                  )}
                </button>
                
                <p className="text-[9px] text-center text-[hsl(var(--site-muted-fg))] leading-tight font-medium px-4">
                  {step === "cart" 
                    ? "Itens selecionados serão revisados no próximo passo."
                    : (orderType === "table"
                      ? `Enviando pedido da Mesa ${tableNumber} para o painel`
                      : (orderType === "pickup"
                        ? `Enviando pedido para o painel`
                        : (flycontrolOn && whatsappOn
                          ? `Enviando para o painel e WhatsApp do ${restaurantName}`
                          : flycontrolOn
                            ? `Enviando para o painel do ${restaurantName}`
                            : `Enviando para o WhatsApp do ${restaurantName}`)))}
                </p>
              </div>
            </div>
          )}
        </aside>

        {isScanning && (
          <div className="relative">
            <QrScanner 
              onScan={onQrScan} 
              onClose={() => {
                setIsScanning(false);
                setDebugQr(null);
              }} 
            />
            
            {/* Visual Debug Area (Overlay) */}
            {debugQr && (
              <div className="fixed bottom-0 left-0 right-0 z-[101] bg-black/90 text-white p-4 font-mono text-[10px] space-y-1 animate-in slide-in-from-bottom-full duration-300">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                  <span className="font-black uppercase tracking-widest text-[8px] text-primary">Debug QR Scanner</span>
                  <span className={`px-2 py-0.5 rounded-full font-black ${debugQr.status === 'Válido!' ? 'bg-emerald-500' : (debugQr.status === 'Validando...' ? 'bg-amber-500' : 'bg-red-500')}`}>
                    {debugQr.status}
                  </span>
                </div>
                <p><span className="text-white/40 uppercase tracking-tighter mr-2">Raw:</span> {debugQr.rawValue}</p>
                <p><span className="text-white/40 uppercase tracking-tighter mr-2">Slug:</span> {debugQr.slug || "n/a"}</p>
                <p><span className="text-white/40 uppercase tracking-tighter mr-2">Token:</span> {debugQr.token || "n/a"}</p>
                {debugQr.reason && <p className="text-red-400 mt-2"><span className="text-white/40 uppercase tracking-tighter mr-2">Erro:</span> {debugQr.reason}</p>}
              </div>
            )}
          </div>
        )}
      </>
  );
}