 import { useState, useMemo } from "react";
import { X, Minus, Plus, Trash2, MapPin, CreditCard, Banknote, MessageSquare } from "lucide-react";
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
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Preencha nome, telefone e endereço");
      return;
    }
    if (hasZones && !selectedZone) {
      setError("Selecione o bairro para calcular a taxa de entrega");
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

       const apiKey = restaurant?.flycontrol_api_key;
       const endpoint = restaurant?.flycontrol_api_url || restaurant?.flycontrol_base_url;
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

          const controller = new AbortController();
         const timeoutId = setTimeout(() => {
           console.warn("⏱️ Timeout de 5s atingido no envio para o FlyControl. Abortando...");
           controller.abort();
         }, 5000);

          try {
            await sendOrderToFlycontrol(restaurant, payload, { signal: controller.signal });
            clearTimeout(timeoutId);
            painelRegistrado = true;
            toast.success("Pedido registrado no FlyControl!");
          } catch (err: any) {
            clearTimeout(timeoutId);
            // O log de erro detalhado já é feito dentro de sendOrderToFlycontrol
            console.warn("⚠️ Continuando para WhatsApp mesmo com erro no registro do painel");
            toast.error("Erro no painel, mas o pedido seguirá via WhatsApp.");
          }
       } else {
         console.log("ℹ️ Endpoint ou API Key ausente (ou desabilitado). Pulando registro no painel e seguindo para WhatsApp.");
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
         className={`fixed top-0 right-0 bottom-0 w-full max-w-md z-50 bg-[hsl(var(--site-bg)/0.8)] backdrop-blur-2xl border-l border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col transition-transform duration-500 ${
           open ? "translate-x-0" : "translate-x-full"
         }`}
       >
         <div className="flex items-center justify-between p-6 border-b border-white/5">
           <div className="flex flex-col">
             <h2 className="font-black text-2xl tracking-tighter uppercase">Minha Seleção</h2>
             <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Cozinha Gourmet</span>
           </div>
           <button
             onClick={onClose}
             className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-90"
             aria-label="Fechar"
           >
             <X className="h-6 w-6" />
           </button>
         </div>

         <div className="flex-1 overflow-y-auto overscroll-contain">
           <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-center text-[hsl(var(--site-muted-fg))] py-12">
              Carrinho vazio. Adicione itens do cardápio.
            </p>
          ) : (
            items.map((l) => (
               <div
                 key={`${l.itemId}-${l.sizeLabel ?? ""}`}
                 className="rounded-2xl border border-white/5 bg-white/5 p-5 relative overflow-hidden group"
               >
                 <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between gap-2">
                   <div className="flex-1 relative z-10">
                     <p className="font-black text-lg tracking-tight uppercase group-hover:text-primary transition-colors">
                       {l.name}
                       {l.sizeLabel ? <span className="text-xs text-primary ml-2 font-bold bg-primary/10 px-2 py-0.5 rounded-md">({l.sizeLabel})</span> : ""}
                     </p>
                    {l.flavors && l.flavors.length > 0 ? (
                      <p className="text-xs text-[hsl(var(--site-muted-fg))] mt-1">
                        Sabores: {l.flavors.join(" + ")}
                      </p>
                    ) : l.description ? (
                      <p className="text-xs text-[hsl(var(--site-muted-fg))] mt-1">
                        {l.description}
                      </p>
                    ) : null}
                  </div>
                   <button
                     onClick={() => removeLine(l.itemId, l.sizeLabel)}
                     className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all relative z-10"
                     aria-label="Remover"
                   >
                     <Trash2 className="h-5 w-5" />
                   </button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                     <button
                       onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity - 1)}
                       className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 inline-flex items-center justify-center hover:border-primary/50 transition-all active:scale-90"
                     >
                       <Minus className="h-4 w-4" />
                     </button>
                     <span className="w-10 text-center font-black text-lg">{l.quantity}</span>
                     <button
                       onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity + 1)}
                       className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 inline-flex items-center justify-center hover:border-primary/50 transition-all active:scale-90"
                     >
                       <Plus className="h-4 w-4" />
                     </button>
                   </div>
                   <span className="font-black text-xl text-primary tracking-tighter">
                     {formatBRL(l.unitPrice * l.quantity)}
                   </span>
                </div>
              </div>
            ))
          )}
          </div>

          <div className="p-4 space-y-6">
            <div className="space-y-4">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary border-b border-white/5 pb-2">Seus Dados</h3>
                <div className="space-y-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50 transition-all font-bold"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="numeric"
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary border-b border-white/5 pb-2">Entrega</h3>
                <div className="space-y-3">
                  {hasZones && (
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                      <select
                        value={zoneId}
                        onChange={(e) => setZoneId(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50 transition-all font-black text-xs uppercase tracking-widest appearance-none"
                      >
                        <option value="" className="bg-[hsl(var(--site-bg))] text-white">Local de Entrega *</option>
                        {deliveryZones.map((z) => (
                          <option key={z.id} value={z.id} className="bg-[hsl(var(--site-bg))] text-white">
                            {z.neighborhood} • {formatBRL(Number(z.fee) || 0)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-[hsl(var(--site-muted-fg))]" />
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Endereço completo (Rua, nº, complemento)"
                      rows={2}
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] focus:outline-none focus:border-[hsl(var(--site-primary))] resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary border-b border-white/5 pb-2">Pagamento e Obs.</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--site-muted-fg))]" />
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] focus:outline-none focus:border-[hsl(var(--site-primary))] appearance-none"
                      >
                        <option value="PIX">PIX</option>
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                        <option value="Dinheiro">Dinheiro</option>
                      </select>
                    </div>

                    {paymentMethod === "Dinheiro" && (
                      <div className="relative">
                        <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--site-muted-fg))]" />
                        <input
                          value={changeFor}
                          onChange={(e) => setChangeFor(e.target.value)}
                          placeholder="Troco para quanto?"
                          inputMode="numeric"
                          className="w-full pl-9 pr-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] focus:outline-none focus:border-[hsl(var(--site-primary))]"
                        />
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-[hsl(var(--site-muted-fg))]" />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observações do pedido..."
                      rows={2}
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] focus:outline-none focus:border-[hsl(var(--site-primary))] resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-white/5 space-y-4 bg-black/40 backdrop-blur-xl sticky bottom-0 mt-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
              <span>Subtotal</span>
              <span>{formatBRL(totalPrice)}</span>
            </div>
            {hasZones && (
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                <span>Logística {selectedZone ? <span className="text-primary italic ml-1">({selectedZone.neighborhood})</span> : ""}</span>
                <span>{selectedZone ? formatBRL(deliveryFee) : "—"}</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-1">
              <span className="font-black text-xs tracking-tighter uppercase text-muted-foreground pb-1">Total a Pagar</span>
              <span className="text-3xl font-black text-primary tracking-tighter glow-bronze">
                {formatBRL(grandTotal)}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleFinish}
            disabled={sending}
            className="btn-leaf w-full py-5 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-30 shadow-2xl group transition-all"
          >
            {sending ? "Transmitindo Cozinha..." : (
              <>
                <span className="uppercase text-sm tracking-[0.2em] font-black">Finalizar Pedido</span>
                <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
              </>
            )}
          </button>
          
          <p className="text-[9px] text-center text-[hsl(var(--site-muted-fg))] leading-tight opacity-50 px-4">
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