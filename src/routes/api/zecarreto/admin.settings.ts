import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { getSettings, setSetting } from "@/lib/zecarreto/services/settings.service";
import { settingUpdateSchema } from "@/lib/zecarreto/validation";

/** Configurações gerais (tempo de oferta, raio de busca, dia do repasse...). */
export const Route = createFileRoute("/api/zecarreto/admin/settings")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({ roles: ["admin"], handler: async () => getSettings() }),
      PUT: zcHandler({
        roles: ["admin"],
        schema: settingUpdateSchema,
        handler: async ({ caller, body }) =>
          setSetting(caller, body.key, body.value, body.description),
      }),
    },
  },
});
