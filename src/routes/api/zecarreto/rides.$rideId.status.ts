import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { transitionRide } from "@/lib/zecarreto/services/rides.service";
import { rideTransitionSchema } from "@/lib/zecarreto/validation";

/** Empurra a corrida para a próxima etapa da esteira. */
export const Route = createFileRoute("/api/zecarreto/rides/$rideId/status")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        schema: rideTransitionSchema,
        handler: async ({ caller, params, body }) =>
          transitionRide(caller, params.rideId, body.to, body.reason),
      }),
    },
  },
});
