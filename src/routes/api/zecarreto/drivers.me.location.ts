import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { requireApprovedDriver } from "@/lib/zecarreto/http/auth";
import { handleLocationPing } from "@/lib/zecarreto/services/tracking.service";
import { locationPingSchema } from "@/lib/zecarreto/validation";

/** Sinal de posição do motorista (o "estou aqui" do mapa). */
export const Route = createFileRoute("/api/zecarreto/drivers/me/location")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["driver"],
        schema: locationPingSchema,
        handler: async ({ caller, body }) => {
          const driverId = await requireApprovedDriver(caller);
          return handleLocationPing(driverId, body);
        },
      }),
    },
  },
});
