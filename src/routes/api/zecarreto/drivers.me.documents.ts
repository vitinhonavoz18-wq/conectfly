import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { zcError } from "@/lib/zecarreto/errors";
import {
  getDriverByProfile,
  listDocuments,
  submitDocument,
} from "@/lib/zecarreto/services/drivers.service";
import { documentUploadSchema } from "@/lib/zecarreto/validation";

export const Route = createFileRoute("/api/zecarreto/drivers/me/documents")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["driver"],
        handler: async ({ caller }) => {
          const driver = await getDriverByProfile(caller.profileId);
          if (!driver) throw zcError.notFound("Cadastro de motorista não encontrado.");
          return listDocuments(driver.id);
        },
      }),
      POST: zcHandler({
        roles: ["driver"],
        schema: documentUploadSchema,
        audit: { action: "document.submit", entity: "zc_documents" },
        handler: async ({ caller, body }) => {
          const driver = await getDriverByProfile(caller.profileId);
          if (!driver) throw zcError.notFound("Cadastro de motorista não encontrado.");
          return submitDocument(caller, driver.id, body);
        },
      }),
    },
  },
});
