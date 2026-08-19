import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { listVehiclesForAdmin } from "@/lib/zecarreto/services/vehicles.service";
import type { ZcVehicleStatus } from "@/lib/zecarreto/domain/enums";

/** Fila de veículos aguardando análise. */
export const Route = createFileRoute("/api/zecarreto/admin/vehicles")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["admin"],
        handler: async ({ query }) =>
          listVehiclesForAdmin({
            status: (query.get("status") as ZcVehicleStatus) || undefined,
            limit: Number(query.get("limit") ?? 20),
            offset: Number(query.get("offset") ?? 0),
          }),
      }),
    },
  },
});
