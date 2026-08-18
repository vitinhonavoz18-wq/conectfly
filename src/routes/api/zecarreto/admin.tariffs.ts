import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { listTariffs, publishTariff } from "@/lib/zecarreto/services/catalog.service";
import { tariffUpsertSchema } from "@/lib/zecarreto/validation";

/** Preços da plataforma. Publicar fecha a tarifa anterior e cria a nova. */
export const Route = createFileRoute("/api/zecarreto/admin/tariffs")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["admin"],
        handler: async ({ query }) =>
          listTariffs({
            categoryId: query.get("category_id") ?? undefined,
            regionId: query.get("region_id") ?? undefined,
          }),
      }),
      POST: zcHandler({
        roles: ["admin"],
        schema: tariffUpsertSchema,
        handler: async ({ caller, body }) => publishTariff(caller, body),
      }),
    },
  },
});
