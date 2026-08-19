import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { listAddons, upsertAddon } from "@/lib/zecarreto/services/catalog.service";
import { addonUpsertSchema } from "@/lib/zecarreto/validation";

/** Adicionais (escada, item pesado, montagem...) — cadastro do admin. */
export const Route = createFileRoute("/api/zecarreto/admin/addons")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["admin"],
        handler: async () => listAddons({ includeInactive: true }),
      }),
      POST: zcHandler({
        roles: ["admin"],
        schema: addonUpsertSchema,
        handler: async ({ caller, body }) => upsertAddon(caller, body),
      }),
    },
  },
});
