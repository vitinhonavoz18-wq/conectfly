import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { getRide } from "@/lib/zecarreto/services/rides.service";

export const Route = createFileRoute("/api/zecarreto/rides/$rideId")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        handler: async ({ caller, params }) => getRide(caller, params.rideId),
      }),
    },
  },
});
