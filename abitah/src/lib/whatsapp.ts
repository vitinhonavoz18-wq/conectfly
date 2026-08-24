import { siteConfig, whatsappLink } from "@/config/site";
import { absoluteUrl, formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/types/cart";

/** Mensagem de interesse em um produto específico (página de produto). */
export function buildProductMessage(input: {
  name: string;
  slug: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
}): string {
  const total = input.unitPrice * input.quantity;
  return [
    `Olá! Tenho interesse neste produto da ${siteConfig.name}:`,
    "",
    `*Produto:* ${input.name}`,
    `*Tamanho:* ${input.size}`,
    `*Cor:* ${input.color}`,
    `*Quantidade:* ${input.quantity}`,
    `*Valor:* ${formatCurrency(total)}`,
    `*Link:* ${absoluteUrl(`/produto/${input.slug}`)}`,
  ].join("\n");
}

export function productWhatsappLink(input: Parameters<typeof buildProductMessage>[0]): string {
  return whatsappLink(buildProductMessage(input));
}

/** Mensagem completa de pedido, enviada no checkout. */
export function buildOrderMessage(input: {
  code: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    cpf?: string;
  };
  address?: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
  } | null;
  shippingLabel: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  couponCode?: string | null;
  shippingPrice: number;
  total: number;
  notes?: string;
}): string {
  const lines: string[] = [
    `*NOVO PEDIDO — ${siteConfig.name}*`,
    `Código: ${input.code}`,
    "",
    "*CLIENTE*",
    `Nome: ${input.customer.fullName}`,
    `E-mail: ${input.customer.email}`,
    `Telefone: ${input.customer.phone}`,
  ];

  if (input.customer.cpf) lines.push(`CPF: ${input.customer.cpf}`);

  if (input.address) {
    lines.push(
      "",
      "*ENTREGA*",
      `${input.address.street}, ${input.address.number}${
        input.address.complement ? ` — ${input.address.complement}` : ""
      }`,
      `${input.address.district} — ${input.address.city}/${input.address.state}`,
      `CEP: ${input.address.cep}`,
    );
  }

  lines.push("", `*FORMA DE ENTREGA:* ${input.shippingLabel}`, "", "*ITENS*");

  input.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.name}`,
      `   Tamanho: ${item.size} | Cor: ${item.color}`,
      `   Qtd: ${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(
        item.unitPrice * item.quantity,
      )}`,
      `   ${absoluteUrl(`/produto/${item.slug}`)}`,
    );
  });

  lines.push(
    "",
    "*RESUMO*",
    `Produtos: ${formatCurrency(input.subtotal)}`,
    `Frete: ${input.shippingPrice === 0 ? "Grátis" : formatCurrency(input.shippingPrice)}`,
  );

  if (input.discount > 0) {
    lines.push(
      `Desconto${input.couponCode ? ` (${input.couponCode})` : ""}: -${formatCurrency(input.discount)}`,
    );
  }

  lines.push(`*TOTAL: ${formatCurrency(input.total)}*`);

  if (input.notes?.trim()) {
    lines.push("", "*OBSERVAÇÕES*", input.notes.trim());
  }

  return lines.join("\n");
}

export function orderWhatsappLink(input: Parameters<typeof buildOrderMessage>[0]): string {
  return whatsappLink(buildOrderMessage(input));
}

/** Mensagem genérica de atendimento (header, rodapé, contato). */
export function supportWhatsappLink(subject?: string): string {
  return whatsappLink(
    subject
      ? `Olá! Vim pelo site da ${siteConfig.name} e gostaria de falar sobre: ${subject}`
      : `Olá! Vim pelo site da ${siteConfig.name} e gostaria de mais informações.`,
  );
}
