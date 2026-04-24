import { useState } from "react";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "./CartContext";
import { formatBRL, formatPhoneMask } from "@/lib/site/format";

interface Props {
  open: boolean;
  onClose: () => void;
  whatsappNumber: string;
  restaurantName: string;
}

export function SiteCartDrawer({ open, onClose, whatsappNumber, restaurantName }: Props) {
  const { items, updateQty, removeLine, totalPrice, clear } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const handleFinish = () => {
    setError("");
    if (items.length === 0) {
      setError("Seu carrinho está vazio");
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Preencha nome, telefone e localização");
      return;
    }
    if (!whatsappNumber) {
      setError("Loja sem WhatsApp configurado");
      return;
    }

    const lines = items.map((l) => {
      const sizeLabel = l.sizeLabel ? ` (${l.sizeLabel})` : "";
      const desc = l.description ? `\n_${l.description}_` : "";
      return `- ${l.quantity}x ${l.name}${sizeLabel} — ${formatBRL(
        l.unitPrice * l.quantity,
      )}${desc}`;
    });

    const message =
      `Olá, gostaria de fazer um pedido!\n\n` +
      `*Nome:* ${name}\n` +
      `*Telefone:* ${phone}\n` +
      `*Localização:* ${address}\n\n` +
      `*Pedido:*\n${lines.join("\n")}\n\n` +
      `*Total: ${formatBRL(totalPrice)}*`;

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    clear();
    setName("");
    setPhone("");
    setAddress("");
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
                    {l.description && (
                      <p className="text-xs text-[hsl(var(--site-muted-fg))] mt-1">
                        {l.description}
                      </p>
                    )}
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
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Endereço completo / localização"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] focus:outline-none focus:border-[hsl(var(--site-primary))] resize-none"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
              {error}
            </p>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[hsl(var(--site-muted-fg))]">Total</span>
            <span className="text-xl font-black text-[hsl(var(--site-secondary))]">
              {formatBRL(totalPrice)}
            </span>
          </div>
          <button
            onClick={handleFinish}
            className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition"
          >
            Finalizar pedido
          </button>
          <p className="text-[10px] text-center text-[hsl(var(--site-muted-fg))]">
            O pedido será enviado para o WhatsApp do {restaurantName}
          </p>
        </div>
      </aside>
    </>
  );
}