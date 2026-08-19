import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { listDocumentsForAdmin } from "@/lib/zecarreto/services/drivers.service";
import type { ZcDocumentStatus } from "@/lib/zecarreto/domain/enums";

/** Fila de documentos aguardando análise. */
export const Route = createFileRoute("/api/zecarreto/admin/documents")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["admin"],
        handler: async ({ query }) =>
          listDocumentsForAdmin({
            status: (query.get("status") as ZcDocumentStatus) || undefined,
            limit: Number(query.get("limit") ?? 20),
            offset: Number(query.get("offset") ?? 0),
          }),
      }),
    },
  },
});
