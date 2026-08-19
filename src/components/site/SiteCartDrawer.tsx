import { X, Minus, Plus, Trash2, MapPin, CreditCard, Banknote, MessageSquare, ShoppingBag, ChevronRight, ArrowLeft, Store, Utensils, Ticket, CheckCircle2, QrCode, Camera, AlertCircle, Loader2 } from "lucide-react";
import { formatBRL, formatPhoneMask } from "@/lib/site/format";
import type { DeliveryZoneRow, RestaurantRow } from "@/lib/site/types";
import { QrScanner } from "./QrScanner";
import { useCheckoutCore } from "./checkout/useCheckoutCore";

interface Props {
  open: boolean;
  onClose: () => void;
  whatsappNumber: string;
  restaurantName: string;
  deliveryZones?: DeliveryZoneRow[];
  restaurant?: RestaurantRow;
}

/**
 * Checkout em painel lateral — o modelo original, e o padrão de quem nunca
 * escolheu outro. O visual é exatamente o mesmo de antes; o que mudou é que
 * a regra do pedido agora mora em `checkout/useCheckoutCore.ts`, para o
 * modelo central usar a mesma conta.
 */
export function SiteCartDrawer(props: Props) {
  const { open, onClose, restaurantName, restaurant, deliveryZones = [] } = props;
  const {
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
  } = useCheckoutCore(props);

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
            {sessionClosed && (
              <div className="mx-4 mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm leading-relaxed text-[hsl(var(--site-fg))]">
                    <p className="font-black uppercase tracking-wide text-[11px] text-destructive mb-1">
                      Mesa encerrada
                    </p>
                    Esta mesa foi encerrada. Para realizar novos pedidos, escaneie novamente o QR Code da mesa.
                  </div>
                </div>
              </div>
            )}
            {validatedTable && step !== "confirmation" && (
              <div className="mx-4 mt-4 rounded-2xl border border-[hsl(var(--site-primary)/0.35)] bg-[hsl(var(--site-primary)/0.08)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--site-primary))]">
                      Mesa {validatedTable.number}
                    </div>
                    <div className="text-[11px] text-[hsl(var(--site-muted-fg))] mt-1">
                      Pedidos realizados: <span className="font-bold text-[hsl(var(--site-fg))]">{sessionOrderCount}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-[hsl(var(--site-muted-fg))] font-bold">
                      Total da Mesa
                    </div>
                    <div className="text-xl font-black tracking-tighter text-[hsl(var(--site-fg))]">
                      {formatBRL(sessionConsumed + totalPrice)}
                    </div>
                    {totalPrice > 0 && sessionConsumed > 0 && (
                      <div className="text-[10px] text-[hsl(var(--site-muted-fg))] mt-0.5">
                        Consumido {formatBRL(sessionConsumed)} + carrinho {formatBRL(totalPrice)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
                        onClick={() => setOrderType("table")}
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
                      <div className="p-6 rounded-[2rem] border-2 border-dashed border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] flex flex-col items-center gap-3 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--site-primary)/0.1)] flex items-center justify-center">
                          <QrCode className="h-7 w-7 text-[hsl(var(--site-primary))]" />
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-tight text-[hsl(var(--site-fg))]">Mesa não identificada</p>
                          <p className="text-[10px] text-[hsl(var(--site-muted-fg))] font-medium uppercase tracking-widest mt-1">
                            Use o botão "Scanear QR da Mesa" no topo da página antes de continuar.
                          </p>
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