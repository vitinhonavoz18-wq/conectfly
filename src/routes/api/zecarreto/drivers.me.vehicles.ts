import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { zcError } from "@/lib/zecarreto/errors";
import { getDriverByProfile } from "@/lib/zecarreto/services/drivers.service";
import {
  createVehicle,
  listVehiclesWithDocuments,
} from "@/lib/zecarreto/services/vehicles.service";
import { vehicleUpsertSchema } from "@/lib/zecarreto/validation";

/** "Meus veículos" — um motorista pode ter quantos precisar. */
export const Route = createFileRoute("/api/zecarreto/drivers/me/vehicles")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["driver"],
        handler: async ({ caller }) => {
          const driver = await getDriverByProfile(caller.profileId);
          if (!driver) throw zcError.notFound("Cadastro de motorista não encontrado.");
          return listVehiclesWithDocuments(driver.id);
        },
      }),
      POST: zcHandler({
        roles: ["driver"],
        schema: vehicleUpsertSchema,
        audit: { action: "vehicle.create", entity: "zc_vehicles" },
        handler: async ({ caller, body }) => {
          const driver = await getDriverByProfile(caller.profileId);
          if (!driver) throw zcError.notFound("Cadastro de motorista não encontrado.");
          return createVehicle(caller, driver.id, body);
        },
      }),
    },
  },
});
