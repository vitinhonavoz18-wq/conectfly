import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import {
  getDriverByProfile,
  registerDriver,
  updateDriverProfile,
} from "@/lib/zecarreto/services/drivers.service";
import { getWallet } from "@/lib/zecarreto/services/wallet.service";
import { uuidSchema } from "@/lib/zecarreto/validation";

const registerSchema = z.object({
  region_id: uuidSchema.optional(),
  cnh_number: z.string().max(30).optional(),
  cnh_category: z.string().max(5).optional(),
  cnh_expires_at: z.string().date().optional(),
});

const patchSchema = z.object({
  region_id: uuidSchema.nullable().optional(),
  pix_key: z.string().max(140).nullable().optional(),
  pix_key_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]).nullable().optional(),
  cnh_number: z.string().max(30).nullable().optional(),
  cnh_category: z.string().max(5).nullable().optional(),
  cnh_expires_at: z.string().date().nullable().optional(),
  current_vehicle_id: uuidSchema.nullable().optional(),
});

export const Route = createFileRoute("/api/zecarreto/drivers/me")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        handler: async ({ caller }) => {
          const driver = await getDriverByProfile(caller.profileId);
          if (!driver) return { driver: null, wallet: null };
          return { driver, wallet: await getWallet(driver.id) };
        },
      }),
      POST: zcHandler({
        schema: registerSchema,
        audit: { action: "driver.register", entity: "zc_drivers" },
        handler: async ({ caller, body }) => registerDriver(caller, body),
      }),
      PATCH: zcHandler({
        roles: ["driver"],
        schema: patchSchema,
        handler: async ({ caller, body }) => {
          const driver = await getDriverByProfile(caller.profileId);
          if (!driver) throw new Error("Cadastro de motorista não encontrado.");
          return updateDriverProfile(caller, driver.id, body);
        },
      }),
    },
  },
});
