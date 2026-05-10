 import { useState, useMemo } from "react";
import { X, Minus, Plus, Trash2, MapPin } from "lucide-react";
import { useCart } from "./CartContext";
import { formatBRL, formatPhoneMask } from "@/lib/site/format";
import type { DeliveryZoneRow, RestaurantRow } from "@/lib/site/types";
import { buildOrderPayload, sendOrderToFlycontrol } from "@/lib/site/flycontrol";
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

    const lines = items.map((l) => {
      const sizeLabel = l.sizeLabel ? ` (${l.sizeLabel})` : "";
      const flavorLine =
        l.flavors && l.flavors.length > 0
          ? `\n   Sabores: ${l.flavors.join(" + ")}`
          : l.description
            ? `\n_${l.description}_`
            : "";
      return `- ${l.quantity}x ${l.name}${sizeLabel} — ${formatBRL(
        l.unitPrice * l.quantity,
      )}${flavorLine}`;
    });

    const locationBlock = selectedZone
      ? `*Bairro:* ${selectedZone.neighborhood}\n*Endereço:* ${address}\n`
      : `*Localização:* ${address}\n`;
    const feeLine = selectedZone
      ? `*Subtotal:* ${formatBRL(totalPrice)}\n*Taxa de entrega (${selectedZone.neighborhood}):* ${formatBRL(deliveryFee)}\n`
      : "";

    const message =
      `Olá, gostaria de fazer um pedido!\n\n` +
      `*Nome:* ${name}\n` +
      `*Telefone:* ${phone}\n` +
      locationBlock +
      `\n*Pedido:*\n${lines.join("\n")}\n\n` +
      feeLine +
      `*Total: ${formatBRL(grandTotal)}*`;

     setSending(true);
     try {
       if (flycontrolOn && restaurant) {
         const payload = buildOrderPayload({
           name,
           phone,
           address,
           neighborhood: selectedZone?.neighborhood ?? null,
           deliveryFee,
           items,
           subtotal: totalPrice,
         });
 
         try {
           await sendOrderToFlycontrol(restaurant, payload);
           toast.success("Pedido enviado para o painel!");
         } catch (err) {
           console.error("[FLYCONTROL] erro:", err);
           toast.error("Erro ao enviar para o painel, mas continuaremos via WhatsApp.");
         }
       }
 
       if (whatsappOn) {
         openWhatsAppOrder(message);
       }
 
       clear();
       setName("");
       setPhone("");
       setAddress("");
       setZoneId("");
       onClose();
     } catch (err) {
       console.error("Erro ao finalizar pedido:", err);
       setError("Ocorreu um erro ao processar seu pedido.");
     } finally {
       setSending(false);
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
        className={`fixed top-0 right-0 bottom-0 w-full max-w-md z-50 bg-[hsl(var(--site-bg))] border-l border-[hsl(var(--site-border))] shadow-2xl flex flex-col transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--site-border))]">
          <h2 className="font-bold text-lg">Seu pedido</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[hsl(var(--site-card))]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-center text-[hsl(var(--site-muted-fg))] py-12">
              Carrinho vazio. Adicione itens do cardápio.
            </p>
          ) : (
            items.map((l) => (
              <div
                key={`${l.itemId}-${l.sizeLabel ?? ""}`}
                className="rounded-lg border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] p-3"
              >
                <div className="flex justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold">
                      {l.name}
                      {l.sizeLabel ? ` (${l.sizeLabel})` : ""}
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
                    className="p-1 text-[hsl(var(--site-muted-fg))] hover:text-red-400"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity - 1)}
                      className="h-7 w-7 rounded-full border border-[hsl(var(--site-border))] inline-flex items-center justify-center hover:bg-[hsl(var(--site-muted))]"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-semibold">{l.quantity}</span>
                    <button
                      onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity + 1)}
                      className="h-7 w-7 rounded-full border border-[hsl(var(--site-border))] inline-flex items-center justify-center hover:bg-[hsl(var(--site-muted))]"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="font-bold text-[hsl(var(--site-secondary))]">
                    {formatBRL(l.unitPrice * l.quantity)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-[hsl(var(--site-border))] space-y-3">
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] focus:outline-none focus:border-[hsl(var(--site-primary))]"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="numeric"
              className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] focus:outline-none focus:border-[hsl(var(--site-primary))]"
            />
            {hasZones && (
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--site-muted-fg))]" />
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] focus:outline-none focus:border-[hsl(var(--site-primary))] appearance-none"
                >
                  <option value="">Selecione seu bairro *</option>
                  {deliveryZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.neighborhood} — {formatBRL(Number(z.fee) || 0)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, complemento..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] focus:outline-none focus:border-[hsl(var(--site-primary))] resize-none"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
              {error}
            </p>
          )}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between items-center text-[hsl(var(--site-muted-fg))]">
              <span>Subtotal</span>
              <span>{formatBRL(totalPrice)}</span>
            </div>
            {hasZones && (
              <div className="flex justify-between items-center text-[hsl(var(--site-muted-fg))]">
                <span>Taxa de entrega {selectedZone ? `(${selectedZone.neighborhood})` : ""}</span>
                <span>{selectedZone ? formatBRL(deliveryFee) : "—"}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-[hsl(var(--site-border))]">
              <span className="text-[hsl(var(--site-muted-fg))]">Total</span>
              <span className="text-xl font-black text-[hsl(var(--site-secondary))]">
                {formatBRL(grandTotal)}
              </span>
            </div>
          </div>
          <button
            onClick={handleFinish}
            disabled={sending}
            className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition disabled:opacity-60"
          >
            {sending ? "Enviando..." : "Finalizar pedido"}
          </button>
          <p className="text-[10px] text-center text-[hsl(var(--site-muted-fg))]">
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