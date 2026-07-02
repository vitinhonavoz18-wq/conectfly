import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_ORIGINS = [
  "https://conectfly.com.br",
  "https://www.conectfly.com.br",
  "https://conectfly.lovable.app",
];

function getCorsHeaders(origin: string | null) {
  let allowOrigin = ALLOWED_ORIGINS[0];
  const isLovablePreview = origin && (
    origin.endsWith(".lovable.app") || 
    origin.includes("lovable.dev") ||
    ALLOWED_ORIGINS.includes(origin)
  );
  if (origin && isLovablePreview) {
    allowOrigin = origin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function joinUrl(base: string, path: string) {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

export const Route = createFileRoute("/api/public/open-table-session")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { headers: getCorsHeaders(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };
        
        try {
          const body = (await request.json()) as {
            restaurant_id?: string;
            payload?: any;
          };
          
          if (!body?.restaurant_id || !body?.payload) {
            return new Response(JSON.stringify({ success: false, error: "Dados incompletos" }), { status: 400, headers });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: r, error } = await supabaseAdmin
            .from("restaurants")
            .select("id, name, slug, flycontrol_api_key, flycontrol_base_url")
            .eq("id", body.restaurant_id)
            .maybeSingle();

          if (error || !r) {
            return new Response(JSON.stringify({ success: false, error: "Pizzaria não encontrada" }), { status: 404, headers });
          }

          // Resolve local table + ensure an open table_sessions row exists.
          // This is what /api/public/flycontrol-table-closed matches against
          // when FlyControl notifies us that the operator closed the table.
          const rawToken = (body.payload?.table_token ?? "").toString().trim();
          const rawNumber = (body.payload?.table_number ?? "").toString().trim();
          let localSessionId: string | null = null;
          let resolvedTableId: string | null = null;
          let resolvedTableNumber: string | null = rawNumber || null;
          try {
            let tableRow: { id: string; table_number: string } | null = null;
            if (rawToken) {
              const { data } = await supabaseAdmin
                .from("restaurant_tables")
                .select("id, table_number")
                .eq("restaurant_id", body.restaurant_id)
                .eq("public_token", rawToken)
                .maybeSingle();
              tableRow = data ?? null;
            }
            if (!tableRow && rawNumber) {
              const { data } = await supabaseAdmin
                .from("restaurant_tables")
                .select("id, table_number")
                .eq("restaurant_id", body.restaurant_id)
                .eq("table_number", rawNumber)
                .maybeSingle();
              tableRow = data ?? null;
            }
            if (tableRow) {
              resolvedTableId = tableRow.id;
              resolvedTableNumber = tableRow.table_number;
              const { data: openRow } = await supabaseAdmin
                .from("table_sessions")
                .select("id")
                .eq("restaurant_id", body.restaurant_id)
                .eq("table_id", tableRow.id)
                .eq("status", "open")
                .order("opened_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (openRow?.id) {
                localSessionId = openRow.id;
                console.log("[OPEN-TABLE-SESSION] Reusing open table_sessions row:", localSessionId);
              } else {
                const { data: inserted, error: insErr } = await supabaseAdmin
                  .from("table_sessions")
                  .insert({
                    restaurant_id: body.restaurant_id,
                    table_id: tableRow.id,
                    table_number: tableRow.table_number,
                    status: "open",
                    opened_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();
                if (insErr) {
                  console.error("[OPEN-TABLE-SESSION] insert table_sessions failed:", insErr);
                } else {
                  localSessionId = inserted?.id ?? null;
                  console.log("[OPEN-TABLE-SESSION] Created table_sessions row:", localSessionId);
                }
              }
            } else {
              console.warn("[OPEN-TABLE-SESSION] Could not resolve restaurant_tables row for token/number:", { rawToken, rawNumber });
            }
          } catch (sessErr) {
            console.error("[OPEN-TABLE-SESSION] table_sessions provisioning error:", sessErr);
          }

          // === DINING SESSION (new source-of-truth identity) ===================
          // Every successful QR scan MUST mint a fresh dining_sessions row. If
          // this insert fails we FAIL the whole request — the dining session is
          // the single source of truth and there is no valid downstream flow
          // without it. No silent fallback.
          let diningSessionId: string | null = null;
          let diningCustomerToken: string | null = null;
          {
            const { data: ds, error: dsErr } = await supabaseAdmin
              .from("dining_sessions")
              .insert({
                restaurant_id: body.restaurant_id,
                table_id: resolvedTableId,
                table_number: resolvedTableNumber ?? rawNumber ?? "QR",
                table_token: rawToken || null,
                status: "active",
                opened_at: new Date().toISOString(),
                legacy_table_session_id: localSessionId,
                metadata: {
                  opened_from: body.payload?.opened_from ?? "qrcode_scan",
                  restaurant_slug: r.slug,
                },
              })
              .select("id, customer_token")
              .single();
            if (dsErr || !ds?.id || !ds?.customer_token) {
              console.error("[OPEN-TABLE-SESSION] dining_sessions insert failed:", dsErr);
              return new Response(
                JSON.stringify({
                  success: false,
                  error: "Não foi possível criar a sessão da mesa. Tente novamente.",
                  code: "dining_session_insert_failed",
                  details: dsErr?.message ?? null,
                }),
                { status: 500, headers },
              );
            }
            diningSessionId = ds.id;
            diningCustomerToken = ds.customer_token as string;
            console.log("[OPEN-TABLE-SESSION] Created dining_sessions row:", diningSessionId);
          }

          let base = (r.flycontrol_base_url ?? "").trim();
          if (!base) {
            // Even without upstream config, we can return our local session so
            // the digital menu has something to track and the close webhook
            // can later match by table_id / table_number.
            return new Response(JSON.stringify({
              success: !!diningSessionId,
              error: diningSessionId ? undefined : "Configuração incompleta",
              session_id: localSessionId,
              dining_session_id: diningSessionId,
              customer_token: diningCustomerToken,
              table_id: resolvedTableId,
              table_number: resolvedTableNumber,
            }), { status: diningSessionId ? 200 : 400, headers });
          }
          if (!base.startsWith("http")) base = "https://" + base;

          const url = joinUrl(base, "api/public/open-table-session");
          const key = (r.flycontrol_api_key ?? "").trim();

          console.log(`[OPEN-TABLE-SESSION] Forwarding to: ${url}`);

          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": key,
              "Authorization": `Bearer ${key}`,
            },
            body: JSON.stringify({
              ...body.payload,
              session_id: localSessionId,
              table_session_id: localSessionId,
              sitecreator_session_id: localSessionId,
              dining_session_id: diningSessionId,
              customer_token: diningCustomerToken,
              api_key: key // Add key to payload as well for backward compatibility
            }),
          });
          
          const txt = await res.text();
          let finalData: any = {};
          try { finalData = JSON.parse(txt); } catch { finalData = { text: txt }; }

          // Extract session_id following the authoritative contract:
          //   1. response.table_session.id            (new FL contract)
          //   2. response.session_id                  (legacy top-level)
          //   3. response.table_session_id            (legacy top-level)
          // Same lookup on `response.response.*` for wrapped FL replies.
          const fcTableSession =
            finalData?.table_session ?? finalData?.response?.table_session ?? null;
          const upstreamSessionId =
            fcTableSession?.id ??
            finalData?.session_id ??
            finalData?.table_session_id ??
            finalData?.response?.session_id ??
            finalData?.response?.table_session_id ??
            null;
          // Adopt nested table_id / table_number when FL provides them.
          if (!resolvedTableId && fcTableSession?.table_id) {
            resolvedTableId = String(fcTableSession.table_id);
          }
          if (!resolvedTableNumber && fcTableSession?.table_number) {
            resolvedTableNumber = String(fcTableSession.table_number);
          }

          const upstreamStatus = (
            finalData?.response?.status ?? finalData?.status ?? finalData?.response?.session_status ?? finalData?.session_status ?? ""
          ).toString().toLowerCase();
          const upstreamClosed = /(closed|fechad|finaliz|encerr|ended)/.test(upstreamStatus);

          const upstreamOk = res.ok && finalData?.success !== false && !upstreamClosed;

          // FlyControl's `table_session.id` is authoritative. Fall back to
          // legacy shapes, then to the local `table_sessions` row. NEVER
          // synthesize a UUID — if none exists, the open failed.
          const finalSessionId: string | null =
            upstreamSessionId ?? localSessionId ?? null;

          const overallSuccess = upstreamOk && !!finalSessionId;

          // IMPORTANT: spread finalData FIRST, then override our authoritative
          // fields so FlyControl's payload can never clobber success/session_id.
          const responseBody = {
            ...finalData,
            success: overallSuccess,
            session_id: finalSessionId,
            dining_session_id: diningSessionId,
            customer_token: diningCustomerToken,
            table_id: resolvedTableId ?? finalData?.table_id ?? null,
            table_number: resolvedTableNumber ?? finalData?.table_number ?? null,
            status: upstreamStatus || finalData?.status || (overallSuccess ? "open" : undefined),
            closed: upstreamClosed,
            already_open: finalData?.already_open ?? finalData?.response?.already_open ?? false,
          };

          console.log("[OPEN-TABLE-SESSION] Returning to client:", { success: overallSuccess, session_id: finalSessionId, dining_session_id: diningSessionId, table_id: resolvedTableId, closed: upstreamClosed, upstreamStatus });

          // If FL rejected the open, mark the dining_session as closed so
          // the browser doesn't retain an orphan active session.
          if (!overallSuccess && diningSessionId) {
            await supabaseAdmin
              .from("dining_sessions")
              .update({ status: "closed", closed_at: new Date().toISOString() })
              .eq("id", diningSessionId);
          }

          return new Response(JSON.stringify(responseBody), { status: overallSuccess ? 200 : res.status, headers });
        } catch (e: any) {
          console.error("[OPEN-TABLE-SESSION] Error:", e);
          return new Response(JSON.stringify({ success: false, error: "Erro interno" }), { status: 500, headers });
        }
      },
    },
  },
});