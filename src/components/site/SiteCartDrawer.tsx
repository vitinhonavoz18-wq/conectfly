import { useState, useMemo, useRef, useEffect } from "react";
import { X, Minus, Plus, Trash2, MapPin, CreditCard, Banknote, MessageSquare, ShoppingBag, ChevronRight, ArrowLeft, Store, Utensils, Ticket, CheckCircle2, QrCode, Camera, AlertCircle, Loader2 } from "lucide-react";
import { useCart } from "./CartContext";
import { formatBRL, formatPhoneMask } from "@/lib/site/format";
import type { DeliveryZoneRow, RestaurantRow } from "@/lib/site/types";
import { buildOrderPayload, sendOrderToFlycontrol, sendOrderToExternalWebhook, sendUnifiedOrderToFiqon } from "@/lib/site/flycontrol";
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
  const [isScanning, setIsScanning] = useState(false);
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
    const params = new URLSearchParams(window.location.search);
    const mesa = params.get("mesa");
    const mode = params.get("mode");
    const token = params.get("table_token") || params.get("token");

    if ((mode === "table" || params.has("table_token") || params.has("token")) && token) {
      handleValidateTable(token);
    } else if (mesa) {
      setTableNumber(mesa);
      setOrderType("table");
    }
  }, [restaurant]); // Re-run when restaurant is loaded

  // Synchronize context validatedTable with local state
  useEffect(() => {
    if (validatedTable) {
      setTableId(validatedTable.id);
      setTableNumber(validatedTable.number);
      setTableToken(validatedTable.token);
      setOrderType("table");
    }
  }, [validatedTable]);

  const extractTableQrData = (qrValue: string) => {
    console.log("QR_RAW_VALUE:", qrValue);
    if (!qrValue) return { restaurant_slug: null, table_token: null };

    // Limpeza inicial: espaços, quebras de linha, aspas extras, caracteres invisíveis
    let cleanedValue = qrValue.trim()
      .replace(/[\n\r]/g, "")
      .replace(/^["'](.+)["']$/, "$1");
    
    console.log("QR_CLEANED_VALUE:", cleanedValue);

    let slug = restaurant?.slug || null;
    let token = null;

    // 1. JSON
    try {
      const parsed = JSON.parse(cleanedValue);
      if (parsed.table_token || parsed.token || parsed.public_token) {
        const result = {
          restaurant_slug: parsed.restaurant_slug || parsed.slug || slug,
          table_token: parsed.table_token || parsed.token || parsed.public_token
        };
        console.log("QR_EXTRACTED_DATA (JSON):", result);
        return result;
      }
    } catch {
      // Not a JSON
    }

    // 2. URL completa ou URL com rota
    try {
      // Tenta tratar como URL se contiver http ou se parecer um path
      const isUrl = cleanedValue.startsWith('http') || cleanedValue.includes('?');
      const urlStr = isUrl ? cleanedValue : `https://dummy.com/${cleanedValue.startsWith('/') ? cleanedValue.substring(1) : cleanedValue}`;
      const url = new URL(urlStr);
      
      console.log("QR_PARSING_URL:", url.toString());

      // Extrair slug da URL se for conectfly.com.br/SLUG
      if (url.hostname.includes("conectfly.com.br") || url.hostname === "localhost") {
        const pathParts = url.pathname.split("/").filter(Boolean);
        // Se o primeiro path não for 'mesa' ou 'table', provavelmente é o slug
        if (pathParts.length > 0 && !["mesa", "table", "m"].includes(pathParts[0].toLowerCase())) {
          slug = pathParts[0];
        }
      }

      // Caso A: ?mode=table&table_token=TOKEN ou ?token=TOKEN ou ?table_token=...
      token = url.searchParams.get("table_token") || 
              url.searchParams.get("token") || 
              url.searchParams.get("public_token");
      
      // Caso B: /mesa/TOKEN ou /table/TOKEN ou /SLUG/mesa/TOKEN
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
    if (!token) {
      // Se não é URL e não é JSON, o próprio valor limpo pode ser o token
      if (!cleanedValue.includes("?") && !cleanedValue.includes("/")) {
        token = cleanedValue;
      }
    }

    const result = { 
      restaurant_slug: slug, 
      table_token: token?.trim() || null 
    };
    
    console.log("QR_EXTRACTED_DATA:", result);
    console.log("QR_RESTAURANT_SLUG_USED:", result.restaurant_slug);
    console.log("QR_TABLE_TOKEN_USED:", result.table_token);
    
    return result;
  };

  const handleValidateTable = async (token: string, slugFromQr?: string | null) => {
    if (!restaurant) {
      console.log("QR_VALIDATE_ERROR_REASON: Restaurante não carregado no componente");
      return false;
    }
    
    if (isValidatingQr) {
      console.log("QR_DUPLICATE_SCAN_IGNORED: Já existe uma validação em curso");
      return false;
    }
    
    setIsValidatingQr(true);
    const targetSlug = (slugFromQr || restaurant.slug)?.trim();
    
    console.log("QR_VALIDATE_ENDPOINT_CALLED:", `RPC/TableQuery: restaurant_slug=${targetSlug}, table_token=${token}`);
    
    try {
      // Consulta oficial via Supabase na tabela restaurant_tables
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("id, table_number, table_name, is_active, public_token, restaurant_id, restaurants!inner(slug)")
        .eq("public_token", token)
        .eq("restaurants.slug", targetSlug)
        .maybeSingle();

      console.log("QR_VALIDATE_RESPONSE:", data);

      if (error) {
        console.log("QR_VALIDATE_ERROR_REASON:", error.message);
        throw error;
      }

      if (!data) {
        console.log("QR_VALIDATE_ERROR_REASON: Mesa não encontrada para este restaurante e token");
        toast.error("QR Code de mesa inválido. Procure um atendente.", { id: "qr-error" });
        return false;
      }

      if (!data.is_active) {
        console.log("QR_VALIDATE_ERROR_REASON: Mesa encontrada mas está inativa (is_active=false)");
        toast.error("Esta mesa está indisponível no momento. Procure um atendente.", { id: "qr-error" });
        return false;
      }

      console.log("QR_VALIDATE_SUCCESS: Mesa identificada com sucesso", data);
      
      const tableData = {
        id: data.id,
        number: data.table_number,
        name: data.table_name,
        token: token,
      };

      setValidatedTable(tableData);
      setTableId(data.id);
      setTableNumber(data.table_number);
      setTableToken(token);
      setOrderType("table");
      
      toast.success(`Mesa ${data.table_number} identificada!`, { id: "qr-error" });
      setIsScanning(false);
      return true;
    } catch (err: any) {
      console.log("QR_VALIDATE_ERROR_REASON: Erro de exceção na chamada", err.message || err);
      toast.error("Falha na validação da mesa", { id: "qr-error" });
      return false;
    } finally {
      setIsValidatingQr(false);
    }
  };

  const onQrScan = async (text: string) => {
    // 1. Trava se já estiver validando ou se já foi validado (para evitar loop)
    if (!text || isValidatingQr || !isScanning) return;
    
    const now = Date.now();
    
    // 2. Regra de Anti-Spam / Cooldown para erros
    if (text === lastInvalidQrRef.current?.value && (now - lastInvalidQrRef.current.at < qrErrorCooldownMs)) {
      // Silenciosamente ignora se for o mesmo erro recente
      return;
    }

    const { restaurant_slug, table_token } = extractTableQrData(text);

    if (!table_token) {
      console.log("QR_VALIDATE_ERROR_REASON: Não foi possível extrair um token do valor lido");
      if (!lastInvalidQrRef.current || text !== lastInvalidQrRef.current.value || (now - lastInvalidQrRef.current.at > qrErrorCooldownMs)) {
        toast.error("QR Code de mesa inválido. Procure um atendente.", { id: "qr-error" });
        lastInvalidQrRef.current = { value: text, at: now };
      }
      return;
    }

    const success = await handleValidateTable(table_token, restaurant_slug);
    if (!success) {
      lastInvalidQrRef.current = { value: text, at: now };
    }
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
    } else if (orderType === "table" && !tableId) {
      errorMessage = "Identifique sua mesa lendo o QR Code";
    } else if (!paymentMethod) {
      firstEmptyField = paymentRef;
      errorMessage = "Selecione uma forma de pagamento";
    } else if (paymentMethod === "Dinheiro" && !changeFor.trim()) {
      firstEmptyField = changeRef;
      errorMessage = "Informe se precisa de troco";
    }

    if (firstEmptyField && firstEmptyField.current) {
      setError(errorMessage);
      firstEmptyField.current?.focus();
      firstEmptyField.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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

    console.log("CHECKOUT_SERVICE_MODE_SELECTED:", orderType);

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
      ticket_number: generatedTicket,
    };

    const messageWhatsApp = buildWhatsAppMessage(orderData);
    const messageFull = buildOrderMessage(orderData, "complete");

    setSending(true);
    let success = false;
    const siteSettings = restaurant?.site_settings as any;
    
    // Prioriza os campos de topo solicitados pelo usuário, mas mantém fallback para site_settings
    let flowMode = restaurant?.order_flow_mode || siteSettings?.order_flow_mode || (restaurant?.fiqon_webhook_url || siteSettings?.external_webhook_url ? "fiqon" : "direct");
    
    // Fallback se Fiqon estiver desativado nas features
    if (!FEATURES.ENABLE_FIQON_AUTOMATION && flowMode === "fiqon") {
      flowMode = "direct";
    }

    const allowDoubleSend = restaurant?.allow_dual_send ?? !!siteSettings?.allow_double_send;
    const externalWebhookUrl = restaurant?.fiqon_webhook_url || siteSettings?.external_webhook_url;
    const whatsappEnabled = restaurant?.continue_opening_whatsapp ?? (restaurant?.whatsapp_enabled !== false);

    // LOGS OBRIGATÓRIOS DO CHECKOUT PÚBLICO
    console.log("CHECKOUT_PUBLICO_INICIADO");
    console.log("MODO_FLUXO_ATIVO:", flowMode);
    console.log("URL_FIQON_USADA:", externalWebhookUrl || "Nenhuma");
    console.log("Permitir envio duplo:", allowDoubleSend);
    console.log("WHATSAPP_LIBERADO_APOS_WEBHOOK:", whatsappEnabled ? "SIM" : "NÃO");

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
        ticket_number: orderData.ticket_number,
      });

      const payload = orderPayload;
      console.log("Payload real enviado:", payload);

      // 1. Envio para FIQON (Webhook Externo) - USANDO FUNÇÃO COMPARTILHADA
      if (FEATURES.ENABLE_FIQON_AUTOMATION && (flowMode === "fiqon" || (allowDoubleSend && flowMode !== "whatsapp"))) {

        if (!externalWebhookUrl) {
          if (flowMode === "fiqon") {
            toast.error("Webhook FIQON não configurado.");
            setSending(false);
            return;
          }
          console.warn("⚠️ Nenhum Webhook Externo configurado para esta pizzaria");
        } else {
          console.log("📤 [WEBHOOK] Enviando para FIQON via função unificada...");
          try {
            // Logs técnicos obrigatórios no checkout público conforme solicitado
            console.log("PAYLOAD_ENVIADO_FIQON:", payload);

            const result = await sendUnifiedOrderToFiqon(payload, restaurant as any, "public_checkout");
            
            console.log("STATUS_RESPOSTA_FIQON:", result.status);
            console.log("RESPOSTA_FIQON:", result.response);

            if (result.success) {
              console.log("✅ [WEBHOOK] Pedido confirmado pela FIQON");
              success = true;
            } else {
              console.error("❌ [WEBHOOK] FIQON retornou erro. Status:", result.status);
              if (flowMode === "fiqon") {
                toast.error(`Erro no FIQON (${result.status}): ${result.error || 'Verifique a URL do webhook'}`);
                setSending(false);
                return; // Bloqueia o fluxo se for o modo principal e falhar
              }
            }
          } catch (webhookErr: any) {
            console.error("❌ [WEBHOOK] Erro fatal no envio para FIQON:", webhookErr.message);
            if (flowMode === "fiqon") {
              toast.error("Erro de conexão com o Webhook FIQON.");
              setSending(false);
              return;
            }
          }
        }
      }


      // 2. Envio Direto para FlyControl se estiver no modo direct ou double send e não foi sucesso no fiqon
      if (flycontrolOn && restaurant && (flowMode === "direct" || (allowDoubleSend && !success))) {
        console.log("📤 [CHECKOUT] Enviando DIRETAMENTE para FlyControl");
        
        try {
          const result = await sendOrderToFlycontrol(restaurant, orderPayload);
          if (result.success) {
            success = true;
            console.log("✅ [CHECKOUT] Pedido confirmado no FlyControl");
          } else if (flowMode === "direct") {
            toast.error("Erro ao registrar pedido no painel direto.");
            setSending(false);
            return;
          }
        } catch (err: any) {
          console.error("❌ [CHECKOUT] Erro no envio direto para FlyControl:", err.message);
          if (flowMode === "direct") {
            toast.error("Erro de conexão com o painel direto.");
            setSending(false);
            return;
          }
        }
      }

      // Se chegamos aqui e o modo não é apenas WhatsApp, precisamos de algum sucesso no painel
      if (!success && flowMode !== "whatsapp") {
        console.warn("⚠️ Pedido não foi registrado em nenhum painel.");
        // Se for whatsapp puro, a gente continua. Se for outro modo e não deu certo, a gente já deu return acima.
      } else if (success || flowMode === "whatsapp") {
        // TUDO CERTO!
        toast.success("Pedido confirmado com sucesso!");
        
        // Redirecionar para WhatsApp APÓS o envio se habilitado (SOMENTE PARA DELIVERY)
        if (whatsappEnabled && orderType === "delivery") {
          console.log("📲 [CHECKOUT] Abrindo WhatsApp para pedido Delivery");
          openWhatsAppOrder(messageWhatsApp);
        }

        // Limpar carrinho e fechar SOMENTE EM CASO DE SUCESSO
        clear();
        
        if (orderType === "pickup" || orderType === "table") {
          setFinishedOrder(orderData);
          setStep("confirmation");
        } else {
          // Delivery normal fecha o drawer
          setName("");
          setPhone("");
          setAddress("");
          setPaymentMethod("PIX");
          setChangeFor("");
          setNotes("");
          setZoneId("");
          onClose();
        }
      }

    } catch (err) {
      console.error("❌ [CHECKOUT] Erro geral ao finalizar pedido:", err);
      setError("Ocorreu um erro ao processar seu pedido.");
    } finally {
      setSending(false);
      console.log("🏁 [CHECKOUT] Fluxo de finalização encerrado");
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
                        <span className="text-[10px] font-black uppercase tracking-tight">Mesa</span>
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
                            setTableId(null);
                            setTableNumber(null);
                            setTableToken(null);
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
                
                {orderType !== "pickup" && orderType !== "table" && (
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
                    <span className="animate-pulse">PROCESSANDO...</span>
                  ) : (
                    <>
                      <span>{step === "cart" ? "Próximo Passo" : "Finalizar Pedido"}</span>
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
                    : (flycontrolOn && whatsappOn
                      ? `Enviando para o painel e WhatsApp do ${restaurantName}`
                      : flycontrolOn
                        ? `Enviando para o painel do ${restaurantName}`
                        : `Enviando para o WhatsApp do ${restaurantName}`)}
                </p>
              </div>
            </div>
          )}
        </aside>

        {isScanning && (
          <QrScanner 
            onScan={onQrScan} 
            onClose={() => setIsScanning(false)} 
          />
        )}
      </>
  );
}