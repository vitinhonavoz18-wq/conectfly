import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { closeWeeklyPayouts, currentPayoutPeriod } from "@/lib/zecarreto/services/payouts.service";
import { releaseMaturedEarnings } from "@/lib/zecarreto/services/wallet.service";

const closeSchema = z.object({
  period_start: z.string().date().optional(),
  period_end: z.string().date().optional(),
});

/** Fecha a semana e gera os repasses de todos os motoristas. */
export const Route = createFileRoute("/api/zecarreto/admin/payouts/close")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["admin"],
        schema: closeSchema,
        handler: async ({ caller, body }) => {
          const released = await releaseMaturedEarnings();
          const period =
            body.period_start && body.period_end
              ? { start: body.period_start, end: body.period_end }
              : await currentPayoutPeriod();
          const payouts = await closeWeeklyPayouts(caller, period);
          return { period, released, payouts };
        },
      }),
    },
  },
});
