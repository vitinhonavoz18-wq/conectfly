import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { listTickets, openTicket } from "@/lib/zecarreto/services/support.service";
import { ticketSchema } from "@/lib/zecarreto/validation";
import type { ZcTicketStatus } from "@/lib/zecarreto/domain/enums";

export const Route = createFileRoute("/api/zecarreto/support/tickets")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        handler: async ({ caller, query }) =>
          listTickets(caller, {
            status: (query.get("status") as ZcTicketStatus) || undefined,
            limit: Number(query.get("limit") ?? 20),
            offset: Number(query.get("offset") ?? 0),
          }),
      }),
      POST: zcHandler({
        schema: ticketSchema,
        audit: { action: "support.open", entity: "zc_support_tickets" },
        handler: async ({ caller, body }) => openTicket(caller, body),
      }),
    },
  },
});
