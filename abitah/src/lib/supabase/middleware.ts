import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Renova a sessão do Supabase a cada request e protege as rotas privadas.
 * Em modo demonstração o middleware é transparente (não bloqueia nada), para
 * que o site possa ser navegado sem backend.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const protectedAccountRoutes = [
    "/conta/perfil",
    "/conta/pedidos",
    "/conta/enderecos",
    "/conta/favoritos",
  ];
  const isAccountArea = protectedAccountRoutes.some((route) => pathname.startsWith(route));
  const isAdminArea = pathname.startsWith("/admin");

  if (!user && (isAccountArea || isAdminArea)) {
    const loginUrl = new URL("/conta/entrar", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAdminArea) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/conta/perfil?erro=sem-permissao", request.url));
    }
  }

  return response;
}
