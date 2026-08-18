import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { requireApprovedDriver } from "@/lib/zecarreto/http/auth";
import { acceptOffer, declineOffer } from "@/lib/zecarreto/services/dispatch.service";
import { offerResponseSchema } from "@/lib/zecarreto/validation";

/** Aceitar ou recusar uma oferta. Quem aceita primeiro leva. */
export const Route = createFileRoute("/api/zecarreto/offers/$offerId/respond")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["driver"],
        schema: offerResponseSchema,
        audit: { action: "offer.respond", entity: "zc_ride_offers" },
        handler: async ({ caller, params, body }) => {
          const driverId = await requireApprovedDriver(caller);
          if (body.action === "accept") {
            return {
              accepted: true,
              ride: await acceptOffer(params.offerId, driverId, body.vehicle_id),
            };
          }
          return {
            accepted: false,
            offer: await declineOffer(params.offerId, driverId, body.reason),
          };
        },
      }),
    },
  },
});
