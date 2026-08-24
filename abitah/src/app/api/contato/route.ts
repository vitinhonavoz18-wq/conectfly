import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/validations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { onlyDigits } from "@/lib/utils";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  const { error } = await supabase.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    phone: onlyDigits(parsed.data.phone),
    subject: parsed.data.subject,
    message: parsed.data.message,
  });

  if (error) {
    return NextResponse.json({ error: "Não foi possível enviar a mensagem" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
