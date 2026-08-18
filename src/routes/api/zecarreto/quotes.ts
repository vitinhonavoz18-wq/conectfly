import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { createQuote } from "@/lib/zecarreto/services/pricing.service";
import { quoteRequestSchema } from "@/lib/zecarreto/validation";

/** Estimativa de preço. Congela o valor por alguns minutos. */
export const Route = createFileRoute("/api/zecarreto/quotes")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        public: true,
        schema: quoteRequestSchema,
        handler: async ({ body, caller }) => createQuote(body, caller.profileId || null),
      }),
    },
  },
});
