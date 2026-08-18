import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { markPayoutFailed, markPayoutPaid } from "@/lib/zecarreto/services/payouts.service";

const updateSchema = z.object({
  status: z.enum(["paid", "failed"]),
  external_id: z.string().max(120).optional(),
  reason: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/zecarreto/admin/payouts/$payoutId")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      PATCH: zcHandler({
        roles: ["admin"],
        schema: updateSchema,
        handler: async ({ caller, params, body }) =>
          body.status === "paid"
            ? markPayoutPaid(caller, params.payoutId, body.external_id)
            : markPayoutFailed(caller, params.payoutId, body.reason ?? "Falha no repasse"),
      }),
    },
  },
});
