import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { zcAdmin } from "@/lib/zecarreto/db/client";
import { zcError } from "@/lib/zecarreto/errors";
import { maskDriver, maskProfile } from "@/lib/zecarreto/domain/masking";
import { listDocuments } from "@/lib/zecarreto/services/drivers.service";
import { listVehiclesWithDocuments } from "@/lib/zecarreto/services/vehicles.service";
import { listHistory } from "@/lib/zecarreto/services/history.service";

/**
 * Ficha do motorista para o administrador analisar.
 * Os dados sensíveis vêm MASCARADOS: para conferir o número inteiro é
 * preciso pedir para revelar, e esse pedido fica registrado.
 */
export const Route = createFileRoute("/api/zecarreto/admin/drivers/$driverId")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["admin"],
        handler: async ({ params }) => {
          const db = zcAdmin();
          const { data: driver } = await db
            .from("zc_drivers")
            .select("*")
            .eq("id", params.driverId)
            .maybeSingle();
          if (!driver) throw zcError.notFound("Motorista não encontrado.");

          const { data: profile } = await db
            .from("zc_profiles")
            .select("*")
            .eq("id", driver.profile_id)
            .maybeSingle();

          const [documents, vehicles, history] = await Promise.all([
            listDocuments(driver.id),
            listVehiclesWithDocuments(driver.id),
            listHistory({ entityTable: "zc_drivers", entityId: driver.id, limit: 30 }),
          ]);

          return {
            driver: maskDriver(driver),
            profile: profile ? maskProfile(profile) : null,
            documents,
            vehicles,
            history,
          };
        },
      }),
    },
  },
});
