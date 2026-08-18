import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import {
  listNotifications,
  markNotificationsRead,
} from "@/lib/zecarreto/services/notifications.service";
import { uuidSchema } from "@/lib/zecarreto/validation";

const readSchema = z.object({ ids: z.array(uuidSchema).max(200).optional() });

export const Route = createFileRoute("/api/zecarreto/notifications")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        handler: async ({ caller, query }) =>
          listNotifications({
            profileId: caller.profileId,
            onlyUnread: query.get("unread") === "true",
            limit: Number(query.get("limit") ?? 30),
            offset: Number(query.get("offset") ?? 0),
          }),
      }),
      PATCH: zcHandler({
        schema: readSchema,
        handler: async ({ caller, body }) => ({
          marked: await markNotificationsRead(caller.profileId, body.ids),
        }),
      }),
    },
  },
});
