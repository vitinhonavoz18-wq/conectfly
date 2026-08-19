import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { zcAdmin } from "@/lib/zecarreto/db/client";
import { ensureProfile } from "@/lib/zecarreto/services/account.service";

// Só cliente e motorista. Admin nunca se concede sozinho — isso é dado
// pelo dono da plataforma direto no banco.
const roleSchema = z.object({ role: z.enum(["client", "driver"]) });

export const Route = createFileRoute("/api/zecarreto/profile/role")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      POST: zcHandler({
        schema: roleSchema,
        audit: { action: "profile.role.grant", entity: "zc_user_roles" },
        handler: async ({ caller, body }) => {
          await ensureProfile(caller.profileId);
          const { error } = await zcAdmin()
            .from("zc_user_roles")
            .upsert({ user_id: caller.profileId, role: body.role }, { onConflict: "user_id,role" });
          if (error) throw error;
          return { role: body.role, granted: true };
        },
      }),
    },
  },
});
