import { NextResponse } from "next/server";
import { newsletterSchema } from "@/lib/validations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { onlyDigits } from "@/lib/utils";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const parsed = newsletterSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const supabase = await getSupabaseServerClient();

  // Modo demonstração: aceita o cadastro sem persistir, mantendo o fluxo íntegro.
  if (!supabase) {
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  const { error } = await supabase.from("newsletter_subscribers").upsert(
    {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      whatsapp: onlyDigits(parsed.data.whatsapp),
    },
    { onConflict: "email" },
  );

  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar o cadastro" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
