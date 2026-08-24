import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import {
  listMessages,
  markMessagesRead,
  sendMessage,
} from "@/lib/zecarreto/services/messages.service";

const messageSchema = z.object({
  body: z.string().min(1, "Escreva a mensagem.").max(1000),
  attachments: z.array(z.string().max(500)).max(3).optional(),
});

/** Conversa entre cliente e carreteiro, dentro da plataforma. */
export const Route = createFileRoute("/api/zecarreto/rides/$rideId/messages")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        handler: async ({ caller, params, query }) =>
          listMessages(caller, params.rideId, {
            after: query.get("after") ?? undefined,
            limit: Number(query.get("limit") ?? 100),
          }),
      }),
      POST: zcHandler({
        schema: messageSchema,
        handler: async ({ caller, params, body }) =>
          sendMessage(caller, params.rideId, body.body, body.attachments),
      }),
      PATCH: zcHandler({
        handler: async ({ caller, params }) => ({
          read: await markMessagesRead(caller, params.rideId),
        }),
      }),
    },
  },
});
