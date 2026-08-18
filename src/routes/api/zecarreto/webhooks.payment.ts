import { createFileRoute } from "@tanstack/react-router";
import { confirmPayment, failPayment } from "@/lib/zecarreto/services/payments.service";
import { zcJson, zcPreflight } from "@/lib/zecarreto/http/response";

/**
 * Retorno do provedor de pagamento ("o dinheiro caiu").
 *
 * Não usa login: quem chama é o provedor, não uma pessoa. A conferência é
 * por segredo combinado no cabeçalho — é o "senha e contrassenha" entre os
 * dois sistemas. Sem o segredo certo, a chamada é ignorada.
 */
export const Route = createFileRoute("/api/zecarreto/webhooks/payment")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => zcPreflight(request.headers.get("origin")),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const secret = process.env.ZC_PAYMENT_WEBHOOK_SECRET;
        if (!secret) {
          return zcJson(
            { success: false, error: "Webhook de pagamento não configurado.", code: "ZC_INTERNAL" },
            500,
            origin,
          );
        }
        const provided = request.headers.get("x-zc-webhook-secret");
        if (!provided || provided !== secret) {
          return zcJson(
            { success: false, error: "Assinatura inválida.", code: "ZC_FORBIDDEN" },
            403,
            origin,
          );
        }

        try {
          const body = (await request.json()) as {
            payment_id?: string;
            status?: string;
            reason?: string;
          };
          if (!body.payment_id || !body.status) {
            return zcJson(
              {
                success: false,
                error: "payment_id e status são obrigatórios.",
                code: "ZC_VALIDATION",
              },
              422,
              origin,
            );
          }

          if (body.status === "paid") {
            const payment = await confirmPayment(body.payment_id);
            return zcJson({ success: true, data: payment }, 200, origin);
          }
          if (body.status === "failed") {
            const payment = await failPayment(
              body.payment_id,
              body.reason ?? "Recusado pelo provedor",
            );
            return zcJson({ success: true, data: payment }, 200, origin);
          }
          return zcJson({ success: true, data: { ignored: body.status } }, 200, origin);
        } catch (error) {
          console.error("[ZC] webhook de pagamento falhou:", error);
          return zcJson(
            { success: false, error: "Erro interno.", code: "ZC_INTERNAL" },
            500,
            origin,
          );
        }
      },
    },
  },
});
