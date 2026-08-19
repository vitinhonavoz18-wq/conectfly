import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { zcAdmin } from "@/lib/zecarreto/db/client";
import { zcError } from "@/lib/zecarreto/errors";
import { recordAudit } from "@/lib/zecarreto/services/audit.service";
import { revealSchema } from "@/lib/zecarreto/validation";

/**
 * Revelar os dados completos de um motorista.
 *
 * Existe porque às vezes é preciso conferir o CPF de verdade. Mas toda vez
 * que alguém abre esse "envelope lacrado", fica registrado quem abriu,
 * quando e por quê — é o que separa consulta legítima de bisbilhotice.
 */
export const Route = createFileRoute("/api/zecarreto/admin/drivers/$driverId/reveal")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        roles: ["admin"],
        schema: revealSchema,
        handler: async ({ caller, params, body }) => {
          const db = zcAdmin();
          const { data: driver } = await db
            .from("zc_drivers")
            .select(
              "id, profile_id, cnh_number, cnh_category, cnh_expires_at, pix_key, pix_key_type, bank_account",
            )
            .eq("id", params.driverId)
            .maybeSingle();
          if (!driver) throw zcError.notFound("Motorista não encontrado.");

          const { data: profile } = await db
            .from("zc_profiles")
            .select("id, full_name, document_number, phone, email, birth_date")
            .eq("id", driver.profile_id)
            .maybeSingle();

          await recordAudit({
            caller,
            action: "driver.reveal_sensitive",
            entityTable: "zc_drivers",
            entityId: params.driverId,
            metadata: { reason: body.reason },
          });

          return { driver, profile, revealed_at: new Date().toISOString() };
        },
      }),
    },
  },
});
