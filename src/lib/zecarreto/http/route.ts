/**
 * Casca padrão de todo endpoint do ZÉ CARRETO.
 *
 * Cuida sempre da mesma coisa, para nenhum endpoint esquecer: liberação
 * de origem (CORS), leitura do JSON, conferência dos dados, checagem do
 * crachá, tratamento de erro e registro na auditoria.
 */

import type { z } from "zod";
import { ZcError, isZcError, zcError } from "../errors";
import type { ZcRole } from "../domain/enums";
import { resolveCaller, requireRole, type ZcCaller } from "./auth";
import { zcFail, zcOk, zcPreflight } from "./response";
import { recordAudit } from "../services/audit.service";

export interface ZcRouteContext<TBody> {
  request: Request;
  body: TBody;
  params: Record<string, string>;
  query: URLSearchParams;
  caller: ZcCaller;
  origin: string | null;
}

export interface ZcRouteOptions<TSchema extends z.ZodTypeAny | undefined, TResult> {
  /** Papéis que podem chamar. Omitido = qualquer usuário logado. */
  roles?: ZcRole[];
  /** `true` libera para quem não está logado (ex.: catálogo público). */
  public?: boolean;
  schema?: TSchema;
  /** Ação registrada na auditoria quando a chamada dá certo. */
  audit?: { action: string; entity: string };
  handler: (
    ctx: ZcRouteContext<TSchema extends z.ZodTypeAny ? z.infer<TSchema> : undefined>,
  ) => Promise<TResult>;
}

type AnyHandlerArgs = { request: Request; params?: Record<string, string> };

/** Monta um handler pronto para o TanStack Start. */
export function zcHandler<TSchema extends z.ZodTypeAny | undefined, TResult>(
  options: ZcRouteOptions<TSchema, TResult>,
) {
  return async ({ request, params }: AnyHandlerArgs): Promise<Response> => {
    const origin = request.headers.get("origin");
    try {
      const url = new URL(request.url);

      let body: unknown = undefined;
      if (request.method !== "GET" && request.method !== "DELETE") {
        const raw = await request.text();
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            throw zcError.validation("O corpo da requisição não é um JSON válido.");
          }
        }
      }

      if (options.schema) {
        const parsed = options.schema.safeParse(body ?? {});
        if (!parsed.success) {
          throw zcError.validation(
            firstIssueMessage(parsed.error),
            parsed.error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          );
        }
        body = parsed.data;
      }

      let caller: ZcCaller;
      if (options.public) {
        caller = await tryResolveCaller(request);
      } else {
        caller = await resolveCaller(request);
        if (options.roles?.length) requireRole(caller, ...options.roles);
      }

      const result = await options.handler({
        request,
        body: body as never,
        params: params ?? {},
        query: url.searchParams,
        caller,
        origin,
      });

      if (options.audit && caller.profileId) {
        await recordAudit({
          caller,
          action: options.audit.action,
          entityTable: options.audit.entity,
          entityId: extractEntityId(result),
          after: result as never,
        }).catch((error) => console.error("[ZC] falha ao registrar auditoria:", error));
      }

      return zcOk(result, origin);
    } catch (error) {
      return zcFail(error, origin);
    }
  };
}

/** Handler de preflight (o navegador pergunta antes de mandar o pedido). */
export function zcOptions() {
  return async ({ request }: AnyHandlerArgs): Promise<Response> =>
    zcPreflight(request.headers.get("origin"));
}

function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Dados inválidos.";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

async function tryResolveCaller(request: Request): Promise<ZcCaller> {
  try {
    return await resolveCaller(request);
  } catch (error) {
    if (isZcError(error) && error.code === "ZC_UNAUTHENTICATED") {
      return {
        profileId: "",
        profile: null,
        roles: [],
        isAdmin: false,
        isDriver: false,
        isClient: false,
        driverId: null,
        customerId: null,
        accessToken: "",
        ip: null,
        userAgent: request.headers.get("user-agent"),
      };
    }
    throw error;
  }
}

function extractEntityId(result: unknown): string | null {
  if (result && typeof result === "object" && "id" in result) {
    const id = (result as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export { ZcError };
