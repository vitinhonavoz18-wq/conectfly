import { formatBRL, formatDateTime } from "./format";
import type { CartLine } from "./types";

export interface OrderData {
  customer: {
    name: string;
    phone: string;
    address: string;
    neighborhood?: string | null;
  };
  items: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod?: string | null;
  changeFor?: number | null;
  notes?: string | null;
  createdAt?: string;
}

const SEPARATOR = "━━━━━━━━━━━━━━";

export function buildOrderMessage(order: OrderData, version: "compact" | "complete" = "compact"): string {
  const { customer, items, subtotal, deliveryFee, total, paymentMethod, changeFor, notes, createdAt } = order;

  const sections: string[] = [];

  // Header
  sections.push(`${SEPARATOR}\n🍕 NOVO PEDIDO\n${SEPARATOR}`);

  // Customer info
  sections.push(`👤 CLIENTE:\n${customer.name || "Não informado"}`);
  sections.push(`📞 TELEFONE:\n${customer.phone || "Não informado"}`);
  
  const fullAddress = [customer.address, customer.neighborhood].filter(Boolean).join(", ");
  sections.push(`📍 ENDEREÇO:\n${fullAddress || "Não informado"}`);

  // Separate items into pizzas/others and beverages
  const beverageItems = items.filter(i => i.itemId.startsWith('bev-'));
  const mainItems = items.filter(i => !i.itemId.startsWith('bev-'));

   // Main Items (Pizzas, Combos, etc)
   if (mainItems.length > 0) {
     sections.push(`${SEPARATOR}\n🛒 ITENS DO PEDIDO\n${SEPARATOR}`);
     const itemsText = mainItems.map(item => {
       const isCombo = item.itemId.startsWith('combo-') || !item.flavors;
       const sizeLabel = item.sizeLabel ? ` (${item.sizeLabel})` : "";
       let line = `${item.quantity}x ${item.name}${sizeLabel}\n💰 ${formatBRL(item.unitPrice * item.quantity)}`;
       
       if (item.flavors && item.flavors.length > 0) {
         const flavorTitle = item.flavors.length > 1 ? "🍕 Meio a Meio:" : "🍕 Sabor:";
         line += `\n${flavorTitle}\n${item.flavors.map(f => `* ${f}`).join("\n")}`;
       }
       
       if (item.description) {
         if (isCombo || item.description.includes(",") || item.description.includes("\n")) {
           const extras = item.description.split(/[•,\n\+]/).map(e => e.trim()).filter(Boolean);
           line += `\n${isCombo ? "📦 Composição:" : "✨ Opções:"}\n${extras.map(e => `* ${e}`).join("\n")}`;
         } else {
           line += `\n📝 Obs: ${item.description}`;
         }
       }
       return line;
     }).join("\n\n");
     sections.push(itemsText);
   }

  // Beverages
  if (beverageItems.length > 0) {
    sections.push(`${SEPARATOR}\n🥤 BEBIDAS\n${SEPARATOR}`);
    const bevText = beverageItems.map(item => {
      return `${item.quantity}x ${item.name}\n💰 ${formatBRL(item.unitPrice * item.quantity)}`;
    }).join("\n\n");
    sections.push(bevText);
  }

  // Observations (global)
  if (notes || version === "complete") {
    sections.push(`${SEPARATOR}\n📝 OBSERVAÇÕES\n${SEPARATOR}`);
    sections.push(notes || "Não informado");
  }

  // Payment
  sections.push(`${SEPARATOR}\n💵 PAGAMENTO\n${SEPARATOR}`);
  sections.push(`Forma:\n${paymentMethod || "Não informado"}`);
  if (changeFor) {
    sections.push(`Troco para:\n${formatBRL(changeFor)}`);
  }

  // Total
  sections.push(`${SEPARATOR}\n💰 TOTAL\n${SEPARATOR}`);
  if (deliveryFee > 0) {
    sections.push(`Subtotal: ${formatBRL(subtotal)}`);
    sections.push(`Taxa de entrega: ${formatBRL(deliveryFee)}`);
  }
  sections.push(`*Total: ${formatBRL(total)}*`);

  // Timestamp
  sections.push(`${SEPARATOR}\n🕒 HORÁRIO\n${SEPARATOR}`);
  sections.push(formatDateTime(createdAt));

  // Final join with blank lines between ALL sections
  return sections.join("\n\n");
}

/** Shortcut for WhatsApp usage */
export function buildWhatsAppMessage(order: OrderData): string {
  return buildOrderMessage(order, "compact");
}