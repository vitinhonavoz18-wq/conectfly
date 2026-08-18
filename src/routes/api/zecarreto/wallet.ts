import { createFileRoute } from "@tanstack/react-router";
import { zcHandler, zcOptions } from "@/lib/zecarreto/http/route";
import { requireApprovedDriver } from "@/lib/zecarreto/http/auth";
import { getWallet, listTransactions } from "@/lib/zecarreto/services/wallet.service";
import type { ZcTransactionStatus } from "@/lib/zecarreto/domain/enums";

/** Saldo e extrato do motorista. */
export const Route = createFileRoute("/api/zecarreto/wallet")({
  server: {
    handlers: {
      OPTIONS: zcOptions(),
      GET: zcHandler({
        roles: ["driver"],
        handler: async ({ caller, query }) => {
          const driverId = await requireApprovedDriver(caller);
          const [wallet, transactions] = await Promise.all([
            getWallet(driverId),
            listTransactions({
              driverId,
              status: (query.get("status") as ZcTransactionStatus) || undefined,
              limit: Number(query.get("limit") ?? 30),
              offset: Number(query.get("offset") ?? 0),
            }),
          ]);
          return { wallet, transactions };
        },
      }),
    },
  },
});
