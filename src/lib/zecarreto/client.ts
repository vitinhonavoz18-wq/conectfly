/**
 * Ponte entre as telas e a API do ZÉ CARRETO.
 *
 * Roda no NAVEGADOR. Cuida de sempre mandar o crachá (o token de quem está
 * logado) junto do pedido e de transformar erro em mensagem legível.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ZcApiError extends Error {
  code?: string;
  status?: number;
  details?: unknown;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function zcApi<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
  };

  const response = await fetch(`/api/zecarreto${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error?: string;
    code?: string;
    details?: unknown;
  } | null;

  if (!response.ok || !payload?.success) {
    const error = new Error(
      payload?.error ?? "Não conseguimos falar com o servidor. Tente de novo.",
    ) as ZcApiError;
    error.code = payload?.code;
    error.status = response.status;
    error.details = payload?.details;
    throw error;
  }
  return payload.data as T;
}

export type ZcBucketName = "zc-avatars" | "zc-documents";

export interface UploadResult {
  bucket: ZcBucketName;
  path: string;
  publicUrl?: string;
}

/**
 * Envia um arquivo em duas etapas: primeiro pede a autorização ao nosso
 * servidor, depois manda o arquivo direto para o armazenamento. O arquivo
 * nunca passa pelo meio do caminho.
 */
export async function zcUploadFile(
  file: File,
  options: { bucket: ZcBucketName; purpose: string },
): Promise<UploadResult> {
  const signed = await zcApi<{ bucket: ZcBucketName; path: string; token: string }>(
    "/uploads/sign",
    {
      method: "POST",
      body: {
        bucket: options.bucket,
        purpose: options.purpose,
        mime_type: file.type,
        size_bytes: file.size,
      },
    },
  );

  const { error } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
  if (error) throw new Error(`Não conseguimos enviar o arquivo: ${error.message}`);

  const result: UploadResult = { bucket: signed.bucket, path: signed.path };
  if (signed.bucket === "zc-avatars") {
    result.publicUrl = supabase.storage
      .from(signed.bucket)
      .getPublicUrl(signed.path).data.publicUrl;
  }
  return result;
}

/** Mensagem curta de erro, pronta para mostrar num aviso na tela. */
export function zcErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Algo deu errado. Tente de novo.";
}
