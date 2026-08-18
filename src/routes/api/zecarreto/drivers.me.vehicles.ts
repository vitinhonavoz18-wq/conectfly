import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { zcError } from "@/lib/zecarreto/errors";
import {
  addVehicle,
  getDriverByProfile,
  listVehicles,
} from "@/lib/zecarreto/services/drivers.service";
import { vehicleSchema } from "@/lib/zecarreto/validation";

export const Route = createFileRoute("/api/zecarreto/drivers/me/vehicles")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["driver"],
        handler: async ({ caller }) => {
          const driver = await getDriverByProfile(caller.profileId);
          if (!driver) throw zcError.notFound("Cadastro de motorista não encontrado.");
          return listVehicles(driver.id);
        },
      }),
      POST: zcHandler({
        roles: ["driver"],
        schema: vehicleSchema,
        audit: { action: "vehicle.create", entity: "zc_vehicles" },
        handler: async ({ caller, body }) => {
          const driver = await getDriverByProfile(caller.profileId);
          if (!driver) throw zcError.notFound("Cadastro de motorista não encontrado.");
          return addVehicle(caller, driver.id, body);
        },
      }),
    },
  },
});
