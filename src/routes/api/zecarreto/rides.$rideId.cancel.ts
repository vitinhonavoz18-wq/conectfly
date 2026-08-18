import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { cancelRide } from "@/lib/zecarreto/services/rides.service";
import { cancelRideSchema } from "@/lib/zecarreto/validation";

export const Route = createFileRoute("/api/zecarreto/rides/$rideId/cancel")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        schema: cancelRideSchema,
        handler: async ({ caller, params, body }) =>
          cancelRide(caller, params.rideId, body.reason, body.by),
      }),
    },
  },
});
