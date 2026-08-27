/**
 * Toda a regra do checkout, em um lugar só.
 *
 * Este arquivo NÃO desenha nada. Ele guarda o que o pedido é e o que
 * acontece com ele: dados do cliente, entrega ou retirada, mesa, taxa,
 * pagamento, validações, montagem e envio ao FlyControl, WhatsApp.
 *
 * Existe para que os dois visuais do checkout — o painel lateral e o novo
 * modelo central — usem exatamente a mesma conta e o mesmo pedido. Se cada
 * um tivesse a sua cópia, um dia o total de um sairia diferente do outro, e
 * o cliente pagaria errado dependendo do visual que a loja escolheu.
 *
 * O código aqui foi MOVIDO de `SiteCartDrawer.tsx` sem alteração: nenhuma
 * linha de cálculo, validação ou envio foi reescrita.
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { useCart, isValidTableNumber } from "../CartContext";
import { formatPhoneMask } from "@/lib/site/format";
import type { DeliveryZoneRow, RestaurantRow } from "@/lib/site/types";
import { buildOrderPayload, sendOrderToFlycontrol, sendOrderToExternalWebhook, sendUnifiedOrderToFiqon, resolveTablesUrl } from "@/lib/site/flycontrol";
import { buildOrderMessage, buildWhatsAppMessage } from "@/lib/site/orderFormatter";
import { toast } from "sonner";
import { FEATURES } from "@/lib/features";
import { supabase } from "@/integrations/supabase/client";
import { descontoAceiteOf, valorDoDescontoAceite } from "@/lib/site/descontoAceite";

export interface CheckoutCoreParams {
  open: boolean;
  onClose: () => void;
  whatsappNumber: string;
  restaurantName: string;
  deliveryZones?: DeliveryZoneRow[];
  restaurant?: RestaurantRow;
}

export function useCheckoutCore({ open, onClose, whatsappNumber, restaurantName, deliveryZones = [], restaurant }: CheckoutCoreParams) {
  const { items, updateQty, removeLine, totalPrice, clear, validatedTable, setValidatedTable, sessionConsumed, sessionOrderCount, addSessionOrder, sessionClosed: ctxSessionClosed, sessionHydrating, terminateSession: ctxTerminateSession, clearSessionClosed, revalidateSession, validateAndOpenTable } = useCart();
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
  /**
   * "Quero receber ofertas deste restaurante pelo WhatsApp."
   *
   * Começa MARCADO, por decisão do dono do produto. O cliente desmarca se não
   * quiser — e a caixa foi desenhada para isso ficar visível, não escondido
   * (ver AceiteOfertas.tsx). O risco de vir marcada está escrito por extenso
   * naquele arquivo.
   */
  const [aceitaOfertas, setAceitaOfertas] = useState(true);
  const [zoneId, setZoneId] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  // Closure state is now owned by CartContext so it works on every screen.
  const sessionClosed = ctxSessionClosed;

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
    if (!restaurant || sessionHydrating) return;
    
    const params = new URLSearchParams(window.location.search);
    const numberParam =
      params.get("table_number") ||
      params.get("mesa") ||
      params.get("table") ||
      params.get("m");
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
        return;
      }

      console.log("DETECTED_TABLE_PARAMS:", { token, numberParam });
      handleValidateTable(token, null, numberParam);
    } else if (numberParam && isValidTableNumber(numberParam)) {
      setTableNumber(numberParam);
      setOrderType("table");
    }
  }, [restaurant, tableSessionOpened, lastOpenedTableToken, validatedTable, sessionHydrating]); // Re-run when restaurant is loaded or session state changes

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

  // Session closure detection is centralized in CartContext (single polling loop).
  // SiteCartDrawer only consumes shared state and never performs polling or
  // direct session status fetches.


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

  // Centralized termination when FlyControl reports the session as CLOSED.
  // Wipes local table/session/cart state and shows the customer message.
  const terminateClosedSession = (opts?: { silent?: boolean }) => {
    console.log("TABLE_SESSION_CLOSED_BY_FLYCONTROL_TERMINATING");
    // Reset local drawer state; CartContext owns global tear-down + modal.
    setTableId(null);
    setTableNumber(null);
    setTableToken(null);
    setTableSessionId(null);
    setTableSessionOpened(false);
    setLastOpenedTableToken(null);
    setCurrentTableSessionId(null);
    setStep("cart");
    ctxTerminateSession(opts);
    try { toast.dismiss("qr-error"); } catch {}
  };

  const handleValidateTable = async (
    token: string,
    slugFromQr?: string | null,
    numberFromQr?: string | null,
    options?: { silent?: boolean }
  ) => {
    const silent = !!options?.silent;
    if (!restaurant) return false;

    // HARD GUARD: never create or restore a table session without a valid
    // table number + token. Silent placeholders ("N/A", "Mesa", null) used to
    // corrupt every downstream piece of state (session, localStorage, order
    // payload sent to FlyControl). Abort loudly instead.
    const cleanToken = (token || "").trim();
    if (!cleanToken) {
      if (!silent) {
        toast.error("Token da mesa ausente. Escaneie novamente o QR Code.", { id: "qr-error" });
      }
      return false;
    }
    if (!isValidTableNumber(numberFromQr)) {
      if (!silent) {
        toast.error(
          "Número da mesa não identificado. Escaneie novamente o QR Code da mesa.",
          { id: "qr-error", duration: 6000 }
        );
      }
      console.warn("VALIDATE_TABLE_ABORTED_INVALID_NUMBER", { numberFromQr, token: cleanToken });
      return false;
    }
    const resolvedNumber = (numberFromQr as string).trim();

    // If we already detected closure, refuse to (re)open the session silently.
    if (sessionClosed && !silent) {
      toast.error(
        "Esta mesa foi encerrada. Para realizar novos pedidos, escaneie novamente o QR Code da mesa.",
        { id: "qr-error", duration: 6000 }
      );
      return false;
    }
    
    // TRAVAS DE SEGURANÇA (Conforme solicitado)
    if (isOpeningTableSession) {
      console.log("OPEN_TABLE_SESSION_SKIPPED_ALREADY_OPENING");
      return false;
    }
    if (!silent && tableSessionOpened && lastOpenedTableToken === token) {
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
      console.log("NO_ORDER_CREATED_ON_SCAN");
      const sessionResult = await validateAndOpenTable({
        restaurant,
        table_number: resolvedNumber,
        table_token: cleanToken,
        restaurant_slug: targetSlug,
        customer_name: name || undefined,
        customer_phone: phone || undefined,
      });

      console.log("OPEN_TABLE_SESSION_RESPONSE", sessionResult);

      if (sessionResult.success) {
        if (!sessionResult.session_id || !sessionResult.dining_session_id || !sessionResult.customer_token) {
          if (!silent) {
            toast.error("Sessão da mesa não foi confirmada. Escaneie novamente o QR Code.", { id: "qr-error", duration: 6000 });
          }
          return false;
        }

        setTableId("flycontrol-table");
        setTableNumber(resolvedNumber);
        setTableToken(cleanToken);
        setTableSessionId(sessionResult.session_id || null);
        
        // Atualizar travas e IDs
        setTableSessionOpened(true);
        setLastOpenedTableToken(cleanToken);
        setCurrentTableSessionId(sessionResult.session_id || null);
        
        if (sessionResult.session_id) {
          console.log("TABLE_SESSION_ID_SAVED:", sessionResult.session_id);
        }

        setOrderType("table");

        if (!silent) {
          if (sessionResult.already_open) {
            toast.success(`Mesa ${resolvedNumber} já está aberta.`, { id: "qr-success" });
          } else {
            toast.success(`Mesa ${resolvedNumber} aberta com sucesso!`, { id: "qr-success" });
          }
        }
        
        setIsScanning(false);
        return true;
      } else {
        if (sessionResult.closed) {
          terminateClosedSession({ silent });
          return false;
        }
        // Detectar fechamento remoto da mesa (operador finalizou no FlyControl).
        const rawMsg = (sessionResult.message || "").toString().toLowerCase();
        const closedByOperator =
          /closed|fechad|finaliz|encerr|ended|expired|not[_ -]?found|inexist/.test(rawMsg);
        if (closedByOperator) {
          terminateClosedSession({ silent });
          return false;
        }

        // Fallback only if the exact cached session_id is still active on the
        // server. Never restore localStorage as authority.
        const stored = validatedTable;
        if (stored && stored.token?.trim() === token.trim()) {
          const stillActive = await revalidateSession(stored);
          if (!stillActive) return false;
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

        // Menu permanece funcional — não exibir avisos falsos de mesa.
        return false;
      }
    } catch (err: any) {
      console.error("QR_VALIDATE_ERROR:", err);
      if (!silent) {
        toast.error("Falha ao sincronizar mesa. Procure um atendente.", { id: "qr-error" });
      }
      return false;
    } finally {
      setIsValidatingQr(false);
      setIsOpeningTableSession(false);
    }
  };


  const onQrScan = async (text: string) => {
    // 1. Verificações iniciais e bloqueio de múltiplas leituras
    if (!text || isValidatingQr || isOpeningTableSession || !isScanning) return;

    // Permitir nova sessão após uma anterior ter sido encerrada
    if (sessionClosed) {
      clearSessionClosed();
    }
    
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

  /**
   * O desconto por aceitar receber ofertas.
   *
   * O percentual é do restaurante, lido da configuração dele — o navegador
   * nunca escolhe o próprio desconto. E o FlyControl confere de novo quando o
   * pedido chega, com o número que ele mesmo tem guardado; se não bater, vale
   * o do FlyControl.
   *
   * Pedido de mesa fica de fora, e o desconto incide só sobre os produtos,
   * nunca sobre a taxa de entrega — a taxa é dinheiro do entregador.
   */
  const descontoAceitePercent = orderType === "table" ? 0 : descontoAceiteOf(restaurant);
  const descontoAceiteValor =
    aceitaOfertas && descontoAceitePercent > 0
      ? valorDoDescontoAceite(totalPrice, descontoAceitePercent)
      : 0;

  const grandTotal = Math.max(0, totalPrice - descontoAceiteValor + deliveryFee);
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

    // Block submissions for sessions that have been closed remotely.
    if (sessionClosed || (orderType === "table" && (sessionHydrating || !validatedTable))) {
      const msg = "Esta mesa foi encerrada. Para realizar novos pedidos, escaneie novamente o QR Code da mesa.";
      setError(msg);
      toast.error(msg, { id: "qr-error", duration: 6000 });
      return;
    }

    // Server-authoritative re-check for table orders. localStorage is only a
    // cache — never the source of truth. If the table was closed in
    // FlyControl, terminateSession() fires inside revalidateSession() and we
    // bail out before submitting any order.
    if (orderType === "table") {
      const stillActive = await revalidateSession();
      if (!stillActive) {
        const msg = "Esta mesa foi encerrada. Para realizar novos pedidos, escaneie novamente o QR Code da mesa.";
        setError(msg);
        toast.error(msg, { id: "qr-error", duration: 6000 });
        return;
      }
    }

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
      if (!isValidTableNumber(tableNumber)) {
        errorMessage = "O número da mesa não foi identificado.";
      } else if (!tableToken || !tableToken.trim()) {
        errorMessage = "O token de validação da mesa está ausente. Escaneie o QR Code novamente.";
      } else if (!tableSessionId) {
        errorMessage = "Sessão da mesa não está ativa. Escaneie o QR Code novamente.";
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

    // FlyControl é a fonte da verdade para TODOS os modos (delivery, retirada, mesa).
    // O WhatsApp é apenas notificação pós-confirmação para delivery.
    if (!flycontrolOn) {
      setError("Esta loja não está conectada ao painel. Pedidos não podem ser confirmados no momento.");
      return;
    }
    if (orderType === "delivery" && whatsappOn && !whatsappNumber) {
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
        marketing_opt_in: aceitaOfertas,
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
      dining_session_id: orderType === "table" ? (validatedTable?.diningSessionId ?? null) : null,
      customer_token: orderType === "table" ? (validatedTable?.customerToken ?? null) : null,
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

    // CRÍTICO: TODOS os tipos de pedido (delivery, retirada, mesa) exigem
    // confirmação real do FlyControl antes de qualquer notificação ao cliente.
    const requiresBackend = true;
    if (flowMode === "whatsapp") flowMode = "direct";

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
        dining_session_id: (orderData as any).dining_session_id,
        customer_token: (orderData as any).customer_token,
        ticket_number: orderData.ticket_number,
        marketing_opt_in: aceitaOfertas,
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

      // Sucesso só após confirmação real do FlyControl (qualquer modo).
      if (success) {
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
        
        // Registrar consumo acumulado para a sessão de mesa atual.
        if (orderType === "table" && validatedTable) {
          addSessionOrder(grandTotal);
        }

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
      // CORREÇÃO 4: se o FlyControl reportou sessão encerrada durante o
      // submit-order, destruir toda a sessão local imediatamente.
      const raw = `${err?.message || ""}`.toLowerCase();
      const sessionClosed =
        err?.sessionClosed === true ||
        err?.httpStatus === 404 ||
        err?.httpStatus === 409 ||
        /session_closed|session_not_found|dining_session_not_active|invalid_dining_session|mesa encerrada|mesa foi encerrada|table_closed/.test(raw);
      if (sessionClosed) {
        toast.error("Esta mesa foi encerrada. Escaneie novamente o QR Code.");
        terminateClosedSession({ silent: true });
        return;
      }
      const errorMsg = "Não foi possível enviar seu pedido para o painel. Tente novamente ou procure um atendente.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSending(false);
      console.log("CHECKOUT_FLOW_FINISHED");
    }
  };



  return {
    aceitaOfertas, setAceitaOfertas, descontoAceitePercent, descontoAceiteValor,
    addSessionOrder, address, addressRef, changeFor, changeRef, clear, clearSessionClosed,
    currentTableSessionId, debugQr, deliveryFee, error, fieldsContainerRef, finishedOrder,
    flycontrolOn, goToCheckout, grandTotal, handleFinish, handleManualTest, handleValidateTable,
    hasZones, isDelivery, isOpeningTableSession, isScanning, isValidatingQr, items,
    lastOpenedTableToken, manualTableToken, name, nameRef, notes, onQrScan, openWhatsAppOrder,
    orderType, paymentMethod, paymentRef, phone, phoneRef, removeLine, revalidateSession,
    scrollContainerRef, selectedZone, sending, sessionClosed, sessionConsumed, sessionHydrating,
    sessionOrderCount, setAddress, setChangeFor, setCurrentTableSessionId, setDebugQr, setError,
    setFinishedOrder, setIsOpeningTableSession, setIsScanning, setIsValidatingQr,
    setLastOpenedTableToken, setManualTableToken, setName, setNotes, setOrderType,
    setPaymentMethod, setPhone, setSending, setStep, setTableId, setTableNumber, setTableSessionId,
    setTableSessionOpened, setTableToken, setTicketNumber, setValidatedTable,
    setValidationAttempted, setZoneId, step, tableId, tableNumber, tableSessionId,
    tableSessionOpened, tableToken, terminateClosedSession, ticketNumber, totalPrice, updateQty,
    validateAndOpenTable, validatedTable, validationAttempted, whatsappOn, zoneId, zoneRef,
  };
}

export type CheckoutCore = ReturnType<typeof useCheckoutCore>;
