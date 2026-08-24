import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { createShareLink, revokeShareLink } from "@/lib/zecarreto/services/rides.service";

/** Link para mandar a quem está esperando a carga. */
export const Route = createFileRoute("/api/zecarreto/rides/$rideId/share")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        handler: async ({ caller, params }) => createShareLink(caller, params.rideId),
      }),
      DELETE: zcHandler({
        handler: async ({ caller, params }) => {
          await revokeShareLink(caller, params.rideId);
          return { revoked: true };
        },
      }),
    },
  },
});
