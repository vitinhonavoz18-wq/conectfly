import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { zcError } from "@/lib/zecarreto/errors";
import { getDriverByProfile } from "@/lib/zecarreto/services/drivers.service";
import {
  assertOwnsVehicle,
  deactivateVehicle,
  setCurrentVehicle,
  updateVehicle,
} from "@/lib/zecarreto/services/vehicles.service";
import { vehiclePatchSchema } from "@/lib/zecarreto/validation";

export const Route = createFileRoute("/api/zecarreto/drivers/me/vehicles/$vehicleId")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["driver"],
        handler: async ({ caller, params }) => assertOwnsVehicle(caller, params.vehicleId),
      }),
      PATCH: zcHandler({
        roles: ["driver"],
        schema: vehiclePatchSchema,
        handler: async ({ caller, params, body }) => updateVehicle(caller, params.vehicleId, body),
      }),
      // Marcar como veículo em uso.
      POST: zcHandler({
        roles: ["driver"],
        handler: async ({ caller, params }) => {
          const driver = await getDriverByProfile(caller.profileId);
          if (!driver) throw zcError.notFound("Cadastro de motorista não encontrado.");
          return setCurrentVehicle(caller, driver.id, params.vehicleId);
        },
      }),
      DELETE: zcHandler({
        roles: ["driver"],
        handler: async ({ caller, params }) => deactivateVehicle(caller, params.vehicleId),
      }),
    },
  },
});
