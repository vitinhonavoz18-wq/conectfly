import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Interface for the response from safeInvoke
 */
export interface SafeInvokeResponse<T = any> {
  data: T | null;
  error: any | null;
}

/**
 * Safely invokes a Supabase Edge Function by ensuring the session is valid and refreshing it if necessary.
 * 
 * @param functionName The name of the Edge Function to invoke
 * @param options The options to pass to the function (body, headers, etc.)
 * @returns An object containing the data and error
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options?: any,
  requireAuth: boolean = true
): Promise<SafeInvokeResponse<T>> {
  console.log(`[safeInvoke] Preparando chamada para: ${functionName} (Auth: ${requireAuth})`);

  try {
    let currentSession = null;

    if (requireAuth) {
      // 1. Validar a sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("[safeInvoke] Erro ao obter sessão:", sessionError);
        return { data: null, error: sessionError };
      }

      currentSession = session;

      // 2. Se não houver sessão ou se estiver expirada, tentar renovar
      if (!currentSession || (currentSession.expires_at && currentSession.expires_at < Math.floor(Date.now() / 1000) + 60)) {
        console.log("[safeInvoke] Sessão expirada ou prestes a expirar, tentando renovar...");
        
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshedSession) {
          console.error("[safeInvoke] Falha ao renovar sessão:", refreshError);
          
          // 4. Se a renovação falhar, deslogar o usuário e redirecionar
          await supabase.auth.signOut();
          toast.error("Sua sessão expirou. Faça login novamente.");
          
          if (typeof window !== "undefined") {
            window.location.href = "/auth";
          }
          
          return { data: null, error: new Error("Sua sessão expirou. Faça login novamente.") };
        }
        
        console.log("[safeInvoke] Sessão renovada com sucesso.");
        currentSession = refreshedSession;
      }
    }

    // 3. Chamar a Edge Function
    console.log(`[safeInvoke] Invocando ${functionName}...`);
    const { data, error } = await supabase.functions.invoke(functionName, {
      ...options,
      headers: {
        ...options?.headers,
        ...(currentSession ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
      },
    });

    if (error) {
      console.error(`[safeInvoke] Erro na chamada da função ${functionName}:`, error);
      
      // Se o erro for 401 e for uma rota que exige auth
      if (requireAuth && (error.status === 401 || (error.message && error.message.includes("JWT")))) {
         console.warn("[safeInvoke] Recebido 401 da função protegida, forçando novo login...");
         await supabase.auth.signOut();
         if (typeof window !== "undefined") {
            window.location.href = "/auth";
         }
         return { data: null, error: new Error("Não autorizado: JWT inválido ou expirado.") };
      }
      
      return { data: null, error };
    }

    // Validar erros de autorização no body retornado pelo backend
    if (requireAuth && data && data.success === false && (data.status === 401 || data.error?.includes("JWT") || data.error?.includes("Não autorizado"))) {
      console.warn("[safeInvoke] Backend retornou erro de autorização no body.");
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        window.location.href = "/auth";
      }
      return { data: null, error: new Error(data.error || "Sua sessão expirou.") };
    }

    console.log(`[safeInvoke] Chamada para ${functionName} concluída.`);
    return { data, error: null };

  } catch (err: any) {
    console.error(`[safeInvoke] Erro inesperado em ${functionName}:`, err);
    return { data: null, error: err };
  }
}
