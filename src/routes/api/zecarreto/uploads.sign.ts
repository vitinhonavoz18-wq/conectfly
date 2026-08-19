import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { createSignedUpload } from "@/lib/zecarreto/services/storage.service";
import { signUploadSchema } from "@/lib/zecarreto/validation";

/**
 * Pede a autorização para enviar um arquivo.
 * O arquivo vai direto do celular para o armazenamento — o endereço
 * devolvido aqui vale por poucos minutos e só para a pasta de quem pediu.
 */
export const Route = createFileRoute("/api/zecarreto/uploads/sign")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        schema: signUploadSchema,
        handler: async ({ caller, body }) =>
          createSignedUpload({
            profileId: caller.profileId,
            bucket: body.bucket,
            purpose: body.purpose,
            mimeType: body.mime_type,
            sizeBytes: body.size_bytes,
          }),
      }),
    },
  },
});
