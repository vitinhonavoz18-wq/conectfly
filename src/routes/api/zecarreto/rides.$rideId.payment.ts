import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { getRide, confirmRide } from "@/lib/zecarreto/services/rides.service";
import { createPaymentForRide, getPaymentForRide } from "@/lib/zecarreto/services/payments.service";
import { paymentIntentSchema } from "@/lib/zecarreto/validation";

export const Route = createFileRoute("/api/zecarreto/rides/$rideId/payment")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        handler: async ({ caller, params }) => {
          await getRide(caller, params.rideId); // confere permissão
          return getPaymentForRide(params.rideId);
        },
      }),
      POST: zcHandler({
        schema: paymentIntentSchema,
        audit: { action: "payment.create", entity: "zc_payments" },
        handler: async ({ caller, params, body }) => {
          const ride = await getRide(caller, params.rideId);
          // Rascunho vira "aguardando pagamento" antes de gerar a cobrança.
          const ready = ride.status === "draft" ? await confirmRide(caller, ride.id) : ride;
          return createPaymentForRide(caller, ready, body.method, body.idempotency_key);
        },
      }),
    },
  },
});
