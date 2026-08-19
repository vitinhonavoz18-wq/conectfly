import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { createAddress, listAddresses } from "@/lib/zecarreto/services/account.service";
import { addressUpsertSchema } from "@/lib/zecarreto/validation";

/** Endereços favoritos do cliente ("Casa", "Depósito", "Loja"). */
export const Route = createFileRoute("/api/zecarreto/profile/addresses")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({ handler: async ({ caller }) => listAddresses(caller.profileId) }),
      POST: zcHandler({
        schema: addressUpsertSchema,
        audit: { action: "address.create", entity: "zc_addresses" },
        handler: async ({ caller, body }) => createAddress(caller, body),
      }),
    },
  },
});
