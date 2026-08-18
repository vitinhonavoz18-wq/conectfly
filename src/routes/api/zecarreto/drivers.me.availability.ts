import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { requireApprovedDriver } from "@/lib/zecarreto/http/auth";
import { setAvailability } from "@/lib/zecarreto/services/drivers.service";
import { availabilitySchema } from "@/lib/zecarreto/validation";

/** Ligar/desligar o motorista da fila de ofertas. */
export const Route = createFileRoute("/api/zecarreto/drivers/me/availability")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["driver"],
        schema: availabilitySchema,
        handler: async ({ caller, body }) => {
          const driverId = await requireApprovedDriver(caller);
          return setAvailability(driverId, body.availability);
        },
      }),
    },
  },
});
