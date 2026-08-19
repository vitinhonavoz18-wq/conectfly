import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import {
  acceptTerms,
  currentTermsVersion,
  listTermsAcceptances,
} from "@/lib/zecarreto/services/account.service";
import { getSetting } from "@/lib/zecarreto/services/settings.service";
import { termsAcceptSchema } from "@/lib/zecarreto/validation";

/** Termos de uso: qual é a versão vigente e quem já aceitou. */
export const Route = createFileRoute("/api/zecarreto/profile/terms")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        public: true,
        handler: async ({ caller }) => ({
          client_version: await currentTermsVersion("client"),
          driver_version: await currentTermsVersion("driver"),
          url: await getSetting<string>("terms.url", ""),
          accepted: caller.profileId ? await listTermsAcceptances(caller.profileId) : [],
        }),
      }),
      POST: zcHandler({
        schema: termsAcceptSchema,
        audit: { action: "terms.accept", entity: "zc_terms_acceptances" },
        handler: async ({ caller, body }) => acceptTerms(caller, body.audience, body.version),
      }),
    },
  },
});
