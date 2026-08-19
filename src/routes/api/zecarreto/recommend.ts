import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { recommendCategoryForItems } from "@/lib/zecarreto/services/pricing.service";
import { recommendationRequestSchema } from "@/lib/zecarreto/validation";

/**
 * "Não sei qual escolher": recebe os itens marcados e sugere a categoria.
 * É só sugestão — o cliente troca na mão se quiser.
 */
export const Route = createFileRoute("/api/zecarreto/recommend")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        public: true,
        schema: recommendationRequestSchema,
        handler: async ({ body }) => recommendCategoryForItems(body.items),
      }),
    },
  },
});
