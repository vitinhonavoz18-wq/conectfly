import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { findRideByShareToken } from "@/lib/zecarreto/services/rides.service";
import { getTrackingPayload } from "@/lib/zecarreto/services/tracking.service";

/**
 * Acompanhamento por link compartilhado — sem login.
 *
 * Quem tem o link vê o carreto andando, o nome do carreteiro e o veículo.
 * NÃO vê telefone nem valor: acompanhar não é ter acesso à conta.
 */
export const Route = createFileRoute("/api/zecarreto/track/$token")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        public: true,
        handler: async ({ params }) => {
          const ride = await findRideByShareToken(params.token);
          return getTrackingPayload(ride.id, { publicView: true });
        },
      }),
    },
  },
});
