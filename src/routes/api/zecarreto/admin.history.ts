import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { listHistory } from "@/lib/zecarreto/services/history.service";

/** Histórico de alterações de qualquer cadastro. */
export const Route = createFileRoute("/api/zecarreto/admin/history")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["admin"],
        handler: async ({ query }) =>
          listHistory({
            entityTable: query.get("entity_table") ?? undefined,
            entityId: query.get("entity_id") ?? undefined,
            changedBy: query.get("changed_by") ?? undefined,
            limit: Number(query.get("limit") ?? 50),
            offset: Number(query.get("offset") ?? 0),
          }),
      }),
    },
  },
});
