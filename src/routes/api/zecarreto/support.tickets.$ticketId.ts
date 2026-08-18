import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import {
  addTicketMessage,
  getTicket,
  updateTicket,
} from "@/lib/zecarreto/services/support.service";
import { ticketMessageSchema, ticketUpdateSchema } from "@/lib/zecarreto/validation";

export const Route = createFileRoute("/api/zecarreto/support/tickets/$ticketId")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({ handler: async ({ caller, params }) => getTicket(caller, params.ticketId) }),
      POST: zcHandler({
        schema: ticketMessageSchema,
        handler: async ({ caller, params, body }) =>
          addTicketMessage(caller, params.ticketId, body.body, body.attachments),
      }),
      PATCH: zcHandler({
        roles: ["admin"],
        schema: ticketUpdateSchema,
        handler: async ({ caller, params, body }) => updateTicket(caller, params.ticketId, body),
      }),
    },
  },
});
