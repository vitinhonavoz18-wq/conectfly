/**
 * Envio de arquivos (foto, selfie, CNH, documento do veículo).
 *
 * O arquivo NÃO passa pelo nosso servidor. O aplicativo pede uma
 * "autorização de entrega" — um endereço temporário e assinado — e manda o
 * arquivo direto para o armazenamento. É como o porteiro liberar a entrega
 * só naquele apartamento e só nos próximos minutos: ninguém entrega em
 * apartamento alheio, e a liberação vence sozinha.
 *
 * Duas gavetas:
 *  • `zc-avatars`   — foto de perfil e fotos do veículo (podem ser vistas);
 *  • `zc-documents` — CNH, selfie, comprovantes (só o dono e o admin, e
 *    sempre por link temporário).
 */

import { zcAdmin } from "../db/client";
import { zcError } from "../errors";
import { getNumberSetting } from "./settings.service";

export const ZC_BUCKET_AVATARS = "zc-avatars";
export const ZC_BUCKET_DOCUMENTS = "zc-documents";

export type ZcBucket = typeof ZC_BUCKET_AVATARS | typeof ZC_BUCKET_DOCUMENTS;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export interface SignUploadInput {
  profileId: string;
  bucket: ZcBucket;
  /** Para que serve o arquivo: "avatar", "selfie", "cnh", "veiculo/<id>"... */
  purpose: string;
  mimeType: string;
  sizeBytes?: number;
}

export interface SignedUpload {
  bucket: ZcBucket;
  path: string;
  uploadUrl: string;
  token: string;
  expiresInSeconds: number;
}

function sanitizePurpose(purpose: string): string {
  const clean = purpose
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\/+|\/+$/g, "");
  if (!clean) throw zcError.validation("Informe para que serve o arquivo.");
  // Nada de "subir um andar" no caminho.
  if (clean.includes("..")) throw zcError.validation("Caminho de arquivo inválido.");
  return clean;
}

/**
 * Gera a autorização de envio. O caminho SEMPRE começa pela pasta da
 * própria pessoa — quem tentar mandar para a pasta de outro é barrado
 * tanto aqui quanto no armazenamento.
 */
export async function createSignedUpload(input: SignUploadInput): Promise<SignedUpload> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw zcError.validation(
      "Formato não aceito. Envie uma foto (JPG, PNG, WEBP ou HEIC) ou um PDF.",
    );
  }
  const maxMb = await getNumberSetting("upload.max_file_mb");
  if (input.sizeBytes && input.sizeBytes > maxMb * 1024 * 1024) {
    throw zcError.validation(`Arquivo muito grande. O limite é de ${maxMb} MB.`);
  }

  const extension = EXTENSION_BY_MIME[input.mimeType];
  const purpose = sanitizePurpose(input.purpose);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${input.profileId}/${purpose}/${unique}.${extension}`;

  const { data, error } = await zcAdmin().storage.from(input.bucket).createSignedUploadUrl(path);
  if (error || !data) {
    throw zcError.internal(
      "Não conseguimos preparar o envio do arquivo. Tente de novo.",
      error?.message,
    );
  }

  return {
    bucket: input.bucket,
    path,
    uploadUrl: data.signedUrl,
    token: data.token,
    expiresInSeconds: 120,
  };
}

/** Link temporário para ver um arquivo do armário trancado. */
export async function createSignedDownload(
  bucket: ZcBucket,
  path: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await zcAdmin()
    .storage.from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw zcError.notFound("Arquivo não encontrado ou já removido.");
  }
  return data.signedUrl;
}

/** Endereço público (só vale para o armário das fotos de perfil/veículo). */
export function publicUrl(bucket: ZcBucket, path: string): string {
  const { data } = zcAdmin().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Confere que o caminho informado pertence mesmo a quem está falando.
 * Sem isso, alguém poderia dizer "meu documento está na pasta do fulano".
 */
export function assertOwnedPath(path: string, profileId: string, isAdmin = false): void {
  if (isAdmin) return;
  const [folder] = path.split("/");
  if (folder !== profileId) {
    throw zcError.forbidden("Este arquivo não está na sua pasta.");
  }
}

export async function removeFile(bucket: ZcBucket, path: string): Promise<void> {
  const { error } = await zcAdmin().storage.from(bucket).remove([path]);
  if (error) console.error("[ZC] não foi possível remover o arquivo:", error.message);
}
