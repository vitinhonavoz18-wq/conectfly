import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { recoverStaleState } from "@/lib/zecarreto/services/dispatch.service";

/**
 * Faxina de estado: tira do ar quem sumiu, vence ofertas velhas e devolve
 * para a fila os carretos cujo carreteiro parou de dar sinal.
 *
 * Na FASE 5 isto vira tarefa automática, de minuto em minuto.
 */
export const Route = createFileRoute("/api/zecarreto/admin/dispatch/recover")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["admin"],
        handler: async () => recoverStaleState(),
      }),
    },
  },
});
