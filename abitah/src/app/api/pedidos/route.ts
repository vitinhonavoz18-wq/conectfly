import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateOrderCode, onlyDigits } from "@/lib/utils";
import type { CartItem } from "@/types/cart";

type OrderPayload = {
  customer: { fullName: string; email: string; phone: string; cpf?: string };
  address?: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
  } | null;
  shippingMethod: string;
  shippingLabel: string;
  shippingPrice: number;
  couponCode?: string | null;
  discount: number;
  subtotal: number;
  total: number;
  notes?: string;
  items: CartItem[];
};

/**
 * Registra o pedido. Em modo demonstração apenas devolve o código gerado —
 * o fluxo de finalização pelo WhatsApp continua funcionando normalmente.
 */
export async function POST(request: Request) {
  let payload: OrderPayload;
  try {
    payload = (await request.json()) as OrderPayload;
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  if (!payload.items?.length) {
    return NextResponse.json({ error: "Carrinho vazio" }, { status: 422 });
  }

  const code = generateOrderCode();
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ ok: true, code, mode: "demo" });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      code,
      user_id: user?.id ?? null,
      status: "aguardando",
      customer_name: payload.customer.fullName,
      customer_email: payload.customer.email.toLowerCase(),
      customer_phone: onlyDigits(payload.customer.phone),
      customer_cpf: payload.customer.cpf ? onlyDigits(payload.customer.cpf) : null,
      shipping_method: payload.shippingLabel,
      shipping_price: payload.shippingPrice,
      coupon_code: payload.couponCode ?? null,
      discount: payload.discount,
      subtotal: payload.subtotal,
      total: payload.total,
      notes: payload.notes ?? null,
      address: payload.address ?? null,
    })
    .select("id, code")
    .single();

  if (error || !order) {
    // Não bloqueia a venda: o pedido segue pelo WhatsApp mesmo se o registro falhar.
    return NextResponse.json({ ok: true, code, persisted: false });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    payload.items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.name,
      product_slug: item.slug,
      image_url: item.imageUrl,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.unitPrice * item.quantity,
    })),
  );

  return NextResponse.json({ ok: true, code: order.code, persisted: !itemsError });
}
