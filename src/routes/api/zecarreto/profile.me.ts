import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { getAccountSnapshot, updateProfile } from "@/lib/zecarreto/services/account.service";
import { profileUpdateSchema } from "@/lib/zecarreto/validation";

/** Cadastro básico de quem está logado (vale para os três perfis). */
export const Route = createFileRoute("/api/zecarreto/profile/me")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({ handler: async ({ caller }) => getAccountSnapshot(caller) }),
      PUT: zcHandler({
        schema: profileUpdateSchema,
        audit: { action: "profile.update", entity: "zc_profiles" },
        handler: async ({ caller, body }) => updateProfile(caller, body),
      }),
    },
  },
});
