import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { getRide } from "@/lib/zecarreto/services/rides.service";
import { getTrackingPayload } from "@/lib/zecarreto/services/tracking.service";

/** O que o cliente vê enquanto acompanha: motorista, posição, ETA e etapa. */
export const Route = createFileRoute("/api/zecarreto/rides/$rideId/track")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        handler: async ({ caller, params }) => {
          await getRide(caller, params.rideId); // confere permissão
          return getTrackingPayload(params.rideId);
        },
      }),
    },
  },
});
