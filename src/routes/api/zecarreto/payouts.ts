import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { requireApprovedDriver } from "@/lib/zecarreto/http/auth";
import { listPayouts } from "@/lib/zecarreto/services/payouts.service";

/** Repasses semanais do motorista. */
export const Route = createFileRoute("/api/zecarreto/payouts")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["driver"],
        handler: async ({ caller, query }) => {
          const driverId = await requireApprovedDriver(caller);
          return listPayouts({
            driverId,
            limit: Number(query.get("limit") ?? 20),
            offset: Number(query.get("offset") ?? 0),
          });
        },
      }),
    },
  },
});
