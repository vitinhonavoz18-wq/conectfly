import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { requireApprovedDriver } from "@/lib/zecarreto/http/auth";
import { getDriverCurrentRide } from "@/lib/zecarreto/services/rides.service";
import { listDriverOfferCards } from "@/lib/zecarreto/services/dispatch.service";
import { getTrackingPayload } from "@/lib/zecarreto/services/tracking.service";

/**
 * A tela de trabalho do carreteiro numa chamada só:
 * a corrida que ele está tocando agora e as ofertas esperando resposta.
 */
export const Route = createFileRoute("/api/zecarreto/drivers/me/current")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["driver"],
        handler: async ({ caller }) => {
          const driverId = await requireApprovedDriver(caller);
          const [ride, offers] = await Promise.all([
            getDriverCurrentRide(driverId),
            listDriverOfferCards(driverId),
          ]);
          return {
            ride,
            tracking: ride ? await getTrackingPayload(ride.id) : null,
            offers,
          };
        },
      }),
    },
  },
});
