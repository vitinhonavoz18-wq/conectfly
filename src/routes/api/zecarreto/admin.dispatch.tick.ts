import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { zcAdmin } from "@/lib/zecarreto/db/client";
import { expireStaleOffers, startDriverSearch } from "@/lib/zecarreto/services/dispatch.service";
import { getNumberSetting } from "@/lib/zecarreto/services/settings.service";

const tickSchema = z.object({ ride_id: z.string().uuid().optional() });

/**
 * Batida do despacho: vence ofertas velhas e manda a próxima rodada dos
 * carretos que ainda estão procurando motorista.
 *
 * Na FASE 2 isto vira uma tarefa agendada (roda sozinha de minuto em
 * minuto). Por enquanto, o admin pode acionar.
 */
export const Route = createFileRoute("/api/zecarreto/admin/dispatch/tick")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["admin"],
        schema: tickSchema,
        handler: async ({ body }) => {
          const expired = await expireStaleOffers();
          const maxRounds = await getNumberSetting("dispatch.max_rounds");

          let query = zcAdmin()
            .from("zc_rides")
            .select("id")
            .eq("status", "searching_driver")
            .is("deleted_at", null)
            .limit(50);
          if (body.ride_id) query = query.eq("id", body.ride_id);
          const { data: rides } = await query;

          const results = [];
          for (const ride of rides ?? []) {
            // A próxima rodada é sempre a seguinte à última já disparada.
            const { data: lastOffer } = await zcAdmin()
              .from("zc_ride_offers")
              .select("round")
              .eq("ride_id", ride.id)
              .order("round", { ascending: false })
              .limit(1)
              .maybeSingle();
            const nextRound = (lastOffer?.round ?? 0) + 1;
            if (nextRound > maxRounds) continue;
            results.push(await startDriverSearch(ride.id, nextRound));
          }
          return { expiredOffers: expired, dispatched: results };
        },
      }),
    },
  },
});
