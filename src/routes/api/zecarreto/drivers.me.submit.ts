import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { submitDriverForReview } from "@/lib/zecarreto/services/drivers.service";

/** "Terminei meu cadastro, pode analisar." */
export const Route = createFileRoute("/api/zecarreto/drivers/me/submit")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["driver"],
        audit: { action: "driver.submit_for_review", entity: "zc_drivers" },
        handler: async ({ caller }) => submitDriverForReview(caller),
      }),
    },
  },
});
