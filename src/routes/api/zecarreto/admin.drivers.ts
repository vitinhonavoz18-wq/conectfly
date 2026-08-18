import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { listDriversForAdmin } from "@/lib/zecarreto/services/drivers.service";
import type { ZcDriverStatus } from "@/lib/zecarreto/domain/enums";

export const Route = createFileRoute("/api/zecarreto/admin/drivers")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["admin"],
        handler: async ({ query }) =>
          listDriversForAdmin({
            status: (query.get("status") as ZcDriverStatus) || undefined,
            limit: Number(query.get("limit") ?? 20),
            offset: Number(query.get("offset") ?? 0),
          }),
      }),
    },
  },
});
