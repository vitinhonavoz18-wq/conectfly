import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { reviewDriver } from "@/lib/zecarreto/services/drivers.service";
import { driverReviewSchema } from "@/lib/zecarreto/validation";

/** Aprovar, recusar ou suspender um carreteiro. */
export const Route = createFileRoute("/api/zecarreto/admin/drivers/$driverId/review")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["admin"],
        schema: driverReviewSchema,
        handler: async ({ caller, params, body }) =>
          reviewDriver(caller, params.driverId, body.status, {
            reason: body.reason,
            suspendedUntil: body.suspended_until,
          }),
      }),
    },
  },
});
