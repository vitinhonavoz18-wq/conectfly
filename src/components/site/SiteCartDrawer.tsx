import { useState, useMemo, useRef } from "react";
import { X, Minus, Plus, Trash2, MapPin, CreditCard, Banknote, MessageSquare, ShoppingBag } from "lucide-react";
import { useCart } from "./CartContext";
import { formatBRL, formatPhoneMask } from "@/lib/site/format";
import type { DeliveryZoneRow, RestaurantRow } from "@/lib/site/types";
import { buildOrderPayload, sendOrderToFlycontrol } from "@/lib/site/flycontrol";
import { buildOrderMessage, buildWhatsAppMessage } from "@/lib/site/orderFormatter";
 import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  whatsappNumber: string;
  restaurantName: string;
  deliveryZones?: DeliveryZoneRow[];
  restaurant?: RestaurantRow;
}

export function SiteCartDrawer({ open, onClose, whatsappNumber, restaurantName, deliveryZones = [], restaurant }: Props) {
  const { items, updateQty, removeLine, totalPrice, clear } = useCart();
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

  const selectedZone = deliveryZones.find((z) => z.id === zoneId) ?? null;
  const deliveryFee = Number(selectedZone?.fee ?? 0);
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

  const handleFinish = async () => {
    setError("");
    if (items.length === 0) {
      setError("Seu carrinho está vazio");
      return;
    }
    setValidationAttempted(true);

    let firstEmptyField: React.RefObject<HTMLElement | null> | null = null;
    let errorMessage = "";

    if (!name.trim()) {
      firstEmptyField = nameRef;
      errorMessage = "Por favor, preencha seu nome";
    } else if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
      firstEmptyField = phoneRef;
      errorMessage = "Por favor, preencha um telefone válido";
    } else if (hasZones && !selectedZone) {
      firstEmptyField = zoneRef;
      errorMessage = "Selecione o bairro para entrega";
    } else if (!address.trim()) {
      firstEmptyField = addressRef;
      errorMessage = "Informe o seu endereço completo";
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

    const orderData = {
      customer: {
        name,
        phone,
        address,
        neighborhood: selectedZone?.neighborhood || null,
      },
      items,
      subtotal: totalPrice,
      deliveryFee,
      total: grandTotal,
      paymentMethod,
      changeFor: changeFor ? parseFloat(changeFor.replace(",", ".")) : null,
      notes,
      createdAt: new Date().toISOString(),
    };

    const messageWhatsApp = buildWhatsAppMessage(orderData);
    const messageFull = buildOrderMessage(orderData, "complete");

    setSending(true);
    let painelRegistrado = false;

    try {
      console.log("🚀 Iniciando finalização do pedido");

        const pizzeriaSlug = restaurant?.slug;

        if (flycontrolOn && restaurant) {
          const payload = buildOrderPayload({
          name,
          phone,
          address,
          neighborhood: selectedZone?.neighborhood ?? null,
          reference: null,
          deliveryFee,
          items,
          subtotal: totalPrice,
          total: grandTotal,
          paymentMethod,
          changeFor: orderData.changeFor,
          notes: notes.trim(),
          pizzeria_slug: restaurant.slug,
          pizzeria_name: restaurant.name,
           whatsapp_message: messageWhatsApp,
           delivery_type: hasZones ? "delivery" : "retirada",
         });

          // Timeout amplo (25s) para cobrir os retries (1s+2s+4s) do proxy
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            console.warn("⏱️ Timeout de 25s atingido no envio para o FlyControl. Abortando...");
            controller.abort();
          }, 25000);

          console.log("📤 [CHECKOUT] INICIANDO ENVIO REAL para FlyControl", {
            slug: restaurant.slug,
            restaurant_id: restaurant.id,
            items: payload.order.items.length,
            total: payload.order.total,
            order_id: payload.order.id,
          });

          try {
            const result = await sendOrderToFlycontrol(restaurant, payload, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (result.success) {
              painelRegistrado = true;
              console.log("✅ [CHECKOUT] Pedido confirmado no FlyControl", { order_id: result.order_id });
              toast.success("Pedido registrado no FlyControl!");
            } else if (result.skipped) {
              console.log("ℹ️ [CHECKOUT] Envio FlyControl ignorado: " + (result.message || "desativado"));
            }
          } catch (err: any) {
            clearTimeout(timeoutId);
            console.error("❌ [CHECKOUT] Erro ao enviar para FlyControl:", err.message);
            toast.error("Erro no painel, mas o pedido seguirá via WhatsApp.");
          }
       } else {
         console.log("ℹ️ Integração FlyControl desativada para esta pizzaria. Pulando registro no painel e seguindo para WhatsApp.");
       }

    } catch (err) {
      console.error("❌ Erro geral ao finalizar pedido:", err);
      setError("Ocorreu um erro ao processar seu pedido.");
    } finally {
      setSending(false);
      console.log("🏁 Fluxo de finalização encerrado");
    }

    // Redirecionar para WhatsApp SEMPRE, mesmo se o FlyControl falhar
    if (whatsappOn) {
      console.log("📲 Redirecionando para WhatsApp");
      openWhatsAppOrder(messageWhatsApp);
    }

    if (flycontrolOn && !painelRegistrado) {
      console.warn("⚠️ Pedido não foi registrado no painel, mas o fluxo continuou.");
    }

    // Limpar carrinho e fechar após iniciar o redirecionamento
    clear();
    setName("");
    setPhone("");
    setAddress("");
    setPaymentMethod("PIX");
    setChangeFor("");
    setNotes("");
    setZoneId("");
    onClose();
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
          <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--site-border))]">
            <div className="flex flex-col">
              <h2 className="font-black text-2xl tracking-tighter uppercase text-[hsl(var(--site-fg))]">Minha Seleção</h2>
              <span className="text-[10px] text-[hsl(var(--site-primary))] font-black uppercase tracking-[0.2em]">Cozinha Gourmet</span>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-2xl site-btn-secondary active:scale-90"
              aria-label="Fechar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain bg-[hsl(var(--site-bg))]">
            <div className="p-5 space-y-4">
           {items.length === 0 ? (
             <div className="text-center py-16 flex flex-col items-center gap-4">
                <ShoppingBag className="h-16 w-16 text-[hsl(var(--site-border))]" />
                <p className="text-[hsl(var(--site-muted-fg))] font-medium">
                  Seu carrinho está vazio.<br/>Adicione itens do cardápio.
                </p>
             </div>
          ) : (
            items.map((l) => (
               <div
                 key={`${l.itemId}-${l.sizeLabel ?? ""}`}
                 className="rounded-[2rem] border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow"
               >
                 <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--site-primary)/0.03)] to-transparent" />
                <div className="flex justify-between gap-3">
                   <div className="flex-1 relative z-10">
                     <p className="font-black text-lg tracking-tight uppercase text-[hsl(var(--site-fg))] group-hover:text-[hsl(var(--site-primary))] transition-colors">
                       {l.name}
                       {l.sizeLabel ? <span className="text-xs text-[hsl(var(--site-primary))] ml-2 font-bold bg-[hsl(var(--site-primary)/0.05)] px-2 py-0.5 rounded-md">({l.sizeLabel})</span> : ""}
                     </p>
                    {l.flavors && l.flavors.length > 0 ? (
                      <p className="text-sm text-[hsl(var(--site-muted-fg))] mt-1.5 leading-relaxed font-medium">
                        <strong className="text-[hsl(var(--site-fg))]">Sabores:</strong> {l.flavors.join(" + ")}
                      </p>
                    ) : l.description ? (
                      <p className="text-sm text-[hsl(var(--site-muted-fg))] mt-1.5 leading-relaxed">
                        {l.description}
                      </p>
                    ) : null}
                  </div>
                   <button
                     onClick={() => removeLine(l.itemId, l.sizeLabel)}
                     className="p-2.5 text-[hsl(var(--site-muted-fg))] hover:text-destructive hover:bg-destructive/10 rounded-2xl transition-all relative z-10"
                     aria-label="Remover"
                   >
                     <Trash2 className="h-5 w-5" />
                   </button>
                </div>
                <div className="flex justify-between items-center mt-5">
                   <div className="flex items-center gap-3 bg-[hsl(var(--site-bg))] p-1.5 rounded-2xl border border-[hsl(var(--site-border))]">
                      <button
                        onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity - 1)}
                        className="h-9 w-9 site-btn-secondary !rounded-xl active:scale-90"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-black text-lg text-[hsl(var(--site-fg))]">{l.quantity}</span>
                      <button
                        onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity + 1)}
                        className="h-9 w-9 site-btn-primary !rounded-xl active:scale-90"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                   <span className="font-black text-2xl text-[hsl(var(--site-fg))] tracking-tighter">
                     {formatBRL(l.unitPrice * l.quantity)}
                   </span>
                </div>
              </div>
            ))
          )}
          </div>

          <div className="p-6 space-y-8 bg-[hsl(var(--site-card))]" ref={fieldsContainerRef}>
            {validationAttempted && error && (
              <div className="bg-destructive/10 border-2 border-destructive/20 rounded-3xl p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-base font-extrabold text-destructive text-center leading-tight">
                  Quase lá! Preencha seus dados para finalizar o pedido. 🍕
                </p>
              </div>
            )}
 
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[hsl(var(--site-secondary))] flex items-center gap-2">
                  <span className="h-1 w-8 bg-[hsl(var(--site-secondary))] rounded-full"></span>
                  Seus Dados
                </h3>
                <div className="grid gap-3">
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className={`w-full px-5 py-4 rounded-2xl bg-[hsl(var(--site-bg))] border-2 transition-all font-bold focus:outline-none text-[hsl(var(--site-fg))] placeholder:text-[hsl(var(--site-muted-fg))] ${
                      validationAttempted && !name.trim() 
                        ? "border-destructive/40 bg-destructive/5" 
                        : "border-[hsl(var(--site-border))] focus:border-[hsl(var(--site-primary))/0.4]"
                    }`}
                  />
                  <input
                    ref={phoneRef}
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="numeric"
                    className={`w-full px-5 py-4 rounded-2xl bg-[#FFF9F6] border-2 transition-all font-bold focus:outline-none text-[#111] placeholder:text-[#9CA3AF] ${
                      validationAttempted && (!phone.trim() || phone.replace(/\D/g, "").length < 10)
                        ? "border-[#DC2626]/40 bg-[#FEF2F2]" 
                        : "border-[#EFE7E2] focus:border-[hsl(var(--site-primary))/0.4]"
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[#D9A441] flex items-center gap-2">
                  <span className="h-1 w-8 bg-[#D9A441] rounded-full"></span>
                  Entrega
                </h3>
                <div className="grid gap-3">
                  {hasZones && (
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[hsl(var(--site-primary))]" />
                      <select
                        ref={zoneRef}
                        value={zoneId}
                        onChange={(e) => setZoneId(e.target.value)}
                        className={`w-full pl-12 pr-10 py-4 rounded-2xl bg-[#FFF9F6] border-2 transition-all font-black text-sm uppercase tracking-widest appearance-none focus:outline-none text-[#111] ${
                          validationAttempted && !selectedZone
                            ? "border-[#DC2626]/40 bg-[#FEF2F2]" 
                            : "border-[#EFE7E2] focus:border-[hsl(var(--site-primary))/0.4]"
                        }`}
                      >
                        <option value="">Local de Entrega *</option>
                        {deliveryZones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.neighborhood} • {formatBRL(Number(z.fee) || 0)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="relative">
                    <MapPin className="absolute left-4 top-5 h-5 w-5 text-[#9CA3AF]" />
                    <textarea
                      ref={addressRef}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Endereço completo (Rua, nº, complemento)"
                      rows={3}
                      className={`w-full pl-12 pr-5 py-4 rounded-2xl bg-[#FFF9F6] border-2 transition-all font-bold focus:outline-none text-[#111] placeholder:text-[#9CA3AF] resize-none ${
                        validationAttempted && !address.trim()
                          ? "border-[#DC2626]/40 bg-[#FEF2F2]" 
                          : "border-[#EFE7E2] focus:border-[hsl(var(--site-primary))/0.4]"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[#D9A441] flex items-center gap-2">
                  <span className="h-1 w-8 bg-[#D9A441] rounded-full"></span>
                  Pagamento e Obs.
                </h3>
                <div className="grid gap-3">
                  <div className="relative group">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                    <select
                      ref={paymentRef}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className={`w-full pl-12 pr-10 py-4 rounded-2xl bg-[#FFF9F6] border-2 transition-all font-black text-sm uppercase tracking-widest appearance-none focus:outline-none text-[#111] ${
                        validationAttempted && !paymentMethod
                          ? "border-[#DC2626]/40 bg-[#FEF2F2]" 
                          : "border-[#EFE7E2] focus:border-[hsl(var(--site-primary))/0.4]"
                      }`}
                    >
                      <option value="PIX">PIX</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Dinheiro">Dinheiro</option>
                    </select>
                  </div>

                  {paymentMethod === "Dinheiro" && (
                    <div className="relative">
                      <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                      <input
                        ref={changeRef}
                        value={changeFor}
                        onChange={(e) => setChangeFor(e.target.value)}
                        placeholder="Troco para quanto?"
                        inputMode="numeric"
                        className={`w-full pl-12 pr-5 py-4 rounded-2xl bg-[#FFF9F6] border-2 transition-all font-bold focus:outline-none text-[#111] placeholder:text-[#9CA3AF] ${
                          validationAttempted && !changeFor.trim()
                            ? "border-[#DC2626]/40 bg-[#FEF2F2]" 
                            : "border-[#EFE7E2] focus:border-[hsl(var(--site-primary))/0.4]"
                        }`}
                      />
                    </div>
                  )}

                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-5 h-5 w-5 text-[#9CA3AF]" />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Alguma observação importante?"
                      rows={2}
                      className="w-full pl-12 pr-5 py-4 rounded-2xl bg-[#FFF9F6] border-2 border-[#EFE7E2] transition-all font-bold focus:outline-none focus:border-[hsl(var(--site-primary))/0.4] text-[#111] placeholder:text-[#9CA3AF] resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm font-bold text-[#DC2626] bg-[#FEF2F2] border-2 border-[#DC2626]/20 rounded-2xl p-4 text-center">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="p-8 border-t border-[#F3F4F6] space-y-5 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.05)] sticky bottom-0 mt-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-[#555] uppercase tracking-widest">
              <span>Subtotal</span>
              <span className="text-[#111]">{formatBRL(totalPrice)}</span>
            </div>
            {hasZones && (
              <div className="flex justify-between items-center text-xs font-bold text-[#555] uppercase tracking-widest">
                <span>Logística {selectedZone ? <span className="text-[hsl(var(--site-primary))] italic ml-1">({selectedZone.neighborhood})</span> : ""}</span>
                <span className="text-[#111]">{selectedZone ? formatBRL(deliveryFee) : "—"}</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-3 border-t border-dashed border-[#EFE7E2]">
              <span className="font-black text-sm uppercase tracking-tighter text-[#111]">Total a Pagar</span>
              <span className="text-4xl font-black text-[hsl(var(--site-primary))] tracking-tighter">
                {formatBRL(grandTotal)}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleFinish}
            disabled={sending}
            className="w-full py-6 site-btn-success text-xl flex items-center justify-center gap-4 group uppercase tracking-widest"
          >
            {sending ? (
              <span className="animate-pulse">PROCESSANDO...</span>
            ) : (
              <>
                <span>Finalizar Pedido</span>
                <Plus className="h-7 w-7 group-hover:rotate-90 transition-transform" />
              </>
            )}
          </button>
          
          <p className="text-[11px] text-center text-[#9CA3AF] leading-tight font-medium">
            {flycontrolOn && whatsappOn
              ? `Pedido enviado para o painel e WhatsApp do ${restaurantName}`
              : flycontrolOn
                ? `Pedido enviado direto para o painel do ${restaurantName}`
                : `O pedido será enviado para o WhatsApp do ${restaurantName}`}
          </p>
        </div>
      </aside>
    </>
  );
}