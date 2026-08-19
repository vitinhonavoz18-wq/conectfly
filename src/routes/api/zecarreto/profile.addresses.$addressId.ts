import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { deleteAddress, updateAddress } from "@/lib/zecarreto/services/account.service";
import { addressUpsertSchema } from "@/lib/zecarreto/validation";

export const Route = createFileRoute("/api/zecarreto/profile/addresses/$addressId")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      PUT: zcHandler({
        schema: addressUpsertSchema.partial(),
        handler: async ({ caller, params, body }) => updateAddress(caller, params.addressId, body),
      }),
      DELETE: zcHandler({
        handler: async ({ caller, params }) => {
          await deleteAddress(caller, params.addressId);
          return { removed: true };
        },
      }),
    },
  },
});
