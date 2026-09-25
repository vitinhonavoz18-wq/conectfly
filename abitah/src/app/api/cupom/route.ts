import { NextResponse } from "next/server";
import { demoCoupons } from "@/data/products";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Coupon } from "@/types/catalog";

/** Valida um cupom e devolve o desconto calculado para o subtotal informado. */
export async function POST(request: Request) {
  let payload: { code?: string; subtotal?: number };
  try {
    payload = (await request.json()) as { code?: string; subtotal?: number };
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const code = String(payload.code ?? "").trim().toUpperCase();
  const subtotal = Number(payload.subtotal ?? 0);

  if (!code) {
    return NextResponse.json({ error: "Informe o código do cupom" }, { status: 422 });
  }

  const supabase = await getSupabaseServerClient();
  let coupon: Coupon | undefined;

  if (supabase) {
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    if (data) {
      coupon = {
        id: data.id as string,
        code: data.code as string,
        type: data.type as Coupon["type"],
        value: Number(data.value),
        minOrderValue: Number(data.min_order_value ?? 0),
        active: data.active as boolean,
        expiresAt: (data.expires_at as string | null) ?? null,
        description: (data.description as string) ?? "",
      };
    }
  } else {
    coupon = demoCoupons.find((item) => item.code === code);
  }

  if (!coupon || !coupon.active) {
    return NextResponse.json({ error: "Cupom inválido ou expirado" }, { status: 404 });
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "Este cupom já expirou" }, { status: 410 });
  }

  if (subtotal < coupon.minOrderValue) {
    return NextResponse.json(
      {
        error: `Este cupom é válido para pedidos a partir de R$ ${coupon.minOrderValue
          .toFixed(2)
          .replace(".", ",")}`,
      },
      { status: 409 },
    );
  }

  const discount =
    coupon.type === "percent"
      ? Number(((subtotal * coupon.value) / 100).toFixed(2))
      : Math.min(coupon.value, subtotal);

  return NextResponse.json({
    ok: true,
    coupon: { code: coupon.code, discount, description: coupon.description },
  });
}
