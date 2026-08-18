import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { reviewDocument } from "@/lib/zecarreto/services/drivers.service";
import { documentReviewSchema } from "@/lib/zecarreto/validation";

export const Route = createFileRoute("/api/zecarreto/admin/documents/$documentId/review")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["admin"],
        schema: documentReviewSchema,
        handler: async ({ caller, params, body }) =>
          reviewDocument(caller, params.documentId, body.status, body.rejection_reason),
      }),
    },
  },
});
