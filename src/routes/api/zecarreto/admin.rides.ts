import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { listRides } from "@/lib/zecarreto/services/rides.service";
import type { ZcRideStatus } from "@/lib/zecarreto/domain/enums";

export const Route = createFileRoute("/api/zecarreto/admin/rides")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["admin"],
        handler: async ({ caller, query }) =>
          listRides(caller, {
            status: (query.get("status") as ZcRideStatus) || undefined,
            limit: Number(query.get("limit") ?? 30),
            offset: Number(query.get("offset") ?? 0),
          }),
      }),
    },
  },
});
