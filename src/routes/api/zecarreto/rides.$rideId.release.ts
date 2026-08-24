import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { zcAdmin } from "@/lib/zecarreto/db/client";
import { zcError } from "@/lib/zecarreto/errors";
import { requireApprovedDriver } from "@/lib/zecarreto/http/auth";
import { releaseRide } from "@/lib/zecarreto/services/dispatch.service";

const releaseSchema = z.object({
  reason: z.string().min(3, "Conte o motivo — o cliente vai ler.").max(300),
});

/**
 * O carreteiro desiste de um carreto que já tinha aceitado.
 *
 * A corrida não é cancelada: volta para a fila e outro carreteiro é
 * chamado. O cliente é avisado na hora.
 */
export const Route = createFileRoute("/api/zecarreto/rides/$rideId/release")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["driver"],
        schema: releaseSchema,
        audit: { action: "ride.release", entity: "zc_rides" },
        handler: async ({ caller, params, body }) => {
          const driverId = await requireApprovedDriver(caller);
          const { data: ride } = await zcAdmin()
            .from("zc_rides")
            .select("driver_id")
            .eq("id", params.rideId)
            .maybeSingle();
          if (!ride) throw zcError.notFound("Carreto não encontrado.");
          if (ride.driver_id !== driverId) {
            throw zcError.forbidden("Este carreto não é seu.");
          }
          return releaseRide(params.rideId, body.reason, true);
        },
      }),
    },
  },
});
