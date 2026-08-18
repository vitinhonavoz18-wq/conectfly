import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { requireApprovedDriver } from "@/lib/zecarreto/http/auth";
import { listDriverOffers } from "@/lib/zecarreto/services/dispatch.service";

/** Ofertas de carreto esperando resposta do motorista. */
export const Route = createFileRoute("/api/zecarreto/offers")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["driver"],
        handler: async ({ caller }) => {
          const driverId = await requireApprovedDriver(caller);
          return listDriverOffers(driverId);
        },
      }),
    },
  },
});
