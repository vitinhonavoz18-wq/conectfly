import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { reviewVehicle } from "@/lib/zecarreto/services/vehicles.service";
import { vehicleReviewSchema } from "@/lib/zecarreto/validation";

/** Aprovar ou reprovar um veículo — reprovar exige motivo. */
export const Route = createFileRoute("/api/zecarreto/admin/vehicles/$vehicleId/review")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["admin"],
        schema: vehicleReviewSchema,
        handler: async ({ caller, params, body }) =>
          reviewVehicle(caller, params.vehicleId, body.status, body.reason),
      }),
    },
  },
});
