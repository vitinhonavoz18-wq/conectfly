import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { rateRide, getRideRatings } from "@/lib/zecarreto/services/ratings.service";
import { ratingSchema } from "@/lib/zecarreto/validation";

export const Route = createFileRoute("/api/zecarreto/rides/$rideId/rating")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({ handler: async ({ params }) => getRideRatings(params.rideId) }),
      POST: zcHandler({
        schema: ratingSchema,
        audit: { action: "ride.rate", entity: "zc_ratings" },
        handler: async ({ caller, params, body }) => rateRide(caller, params.rideId, body),
      }),
    },
  },
});
