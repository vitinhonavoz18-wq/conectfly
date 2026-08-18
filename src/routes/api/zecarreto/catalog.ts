import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { getPublicCatalog } from "@/lib/zecarreto/services/catalog.service";

/** Categorias, regiões e preços vigentes — é o que a tela de pedido lê. */
export const Route = createFileRoute("/api/zecarreto/catalog")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        public: true,
        handler: async () => getPublicCatalog(),
      }),
    },
  },
});
