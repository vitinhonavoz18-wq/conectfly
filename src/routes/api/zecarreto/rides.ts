import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { createRide, listRides } from "@/lib/zecarreto/services/rides.service";
import { createRideSchema } from "@/lib/zecarreto/validation";
import type { ZcRideStatus } from "@/lib/zecarreto/domain/enums";

export const Route = createFileRoute("/api/zecarreto/rides")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        handler: async ({ caller, query }) =>
          listRides(caller, {
            status: (query.get("status") as ZcRideStatus) || undefined,
            scope: (query.get("scope") as "client" | "driver") || undefined,
            limit: Number(query.get("limit") ?? 20),
            offset: Number(query.get("offset") ?? 0),
          }),
      }),
      POST: zcHandler({
        roles: ["client"],
        schema: createRideSchema,
        audit: { action: "ride.create", entity: "zc_rides" },
        handler: async ({ caller, body }) => createRide(caller, body),
      }),
    },
  },
});
