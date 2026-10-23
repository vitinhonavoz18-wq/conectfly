import { useState } from "react";
import { Loader2, QrCode, Utensils } from "lucide-react";
import { toast } from "sonner";
import { useCart, isValidTableNumber } from "./CartContext";
import { QrScannerSobDemanda } from "./QrScannerSobDemanda";
import type { RestaurantRow } from "@/lib/site/types";

interface Props {
  restaurant: RestaurantRow;
  className?: string;
}

function extractTableQrData(qrValue: string, fallbackSlug?: string | null) {
  if (!qrValue) return { restaurant_slug: fallbackSlug ?? null, table_number: null as string | null, table_token: null as string | null };
  const cleaned = qrValue.trim().replace(/[\n\r]/g, "").replace(/^["'](.+)["']$/, "$1");
  let slug: string | null = fallbackSlug ?? null;
  let token: string | null = null;
  let number: string | null = null;

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.table_token || parsed.token || parsed.public_token) {
      return {
        restaurant_slug: parsed.restaurant_slug || parsed.slug || slug,
        table_number: parsed.table_number || parsed.number || parsed.mesa || parsed.table || null,
        table_token: parsed.table_token || parsed.token || parsed.public_token,
      };
    }
  } catch {}

  try {
    const isUrl = cleaned.startsWith("http") || cleaned.includes("?");
    const urlStr = isUrl ? cleaned : `https://dummy.com/${cleaned.startsWith("/") ? cleaned.slice(1) : cleaned}`;
    const url = new URL(urlStr);
    if (url.hostname.includes("conectfly.com.br") || url.hostname === "localhost") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0 && !["mesa", "table", "m"].includes(parts[0].toLowerCase())) {
        slug = parts[0];
      }
    }
    token = url.searchParams.get("table_token") || url.searchParams.get("token") || url.searchParams.get("public_token");
    number = url.searchParams.get("table_number") || url.searchParams.get("mesa") || url.searchParams.get("table") || url.searchParams.get("m");
    if (!token) {
      const paths = url.pathname.split("/").filter(Boolean);
      const idx = paths.findIndex((p) => ["mesa", "table", "m"].includes(p.toLowerCase()));
      if (idx !== -1 && paths[idx + 1]) token = paths[idx + 1];
    }
  } catch {}

  if (!token && !cleaned.includes("?") && !cleaned.includes("/")) token = cleaned;

  return { restaurant_slug: slug, table_number: number, table_token: token?.trim() || null };
}

export function TableQrScanButton({ restaurant, className }: Props) {
  const { validatedTable, sessionClosed, clearSessionClosed, validateAndOpenTable } = useCart();
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);

  if (restaurant?.table_enabled === false) return null;

  const handleScan = async (text: string) => {
    if (!text || validating) return;

    if (sessionClosed) clearSessionClosed();

    const { restaurant_slug, table_token, table_number } = extractTableQrData(text, restaurant.slug);
    if (!table_token) {
      setScanning(false);
      toast.error("QR Code de mesa inválido. Procure um atendente.", { id: "qr-error" });
      return;
    }
    if (!isValidTableNumber(table_number)) {
      setScanning(false);
      toast.error("Número da mesa não identificado. Escaneie novamente.", { id: "qr-error" });
      return;
    }

    setValidating(true);
    try {
      const result = await validateAndOpenTable({
        restaurant,
        table_number: (table_number as string).trim(),
        table_token: table_token.trim(),
        restaurant_slug: restaurant_slug || restaurant.slug,
      });
      if (result.success) {
        toast.success(
          result.already_open
            ? `Mesa ${table_number} já está aberta.`
            : `Mesa ${table_number} aberta com sucesso!`,
          { id: "qr-success" }
        );
      } else {
        toast.error(
          result.closed
            ? "Esta mesa foi encerrada. Solicite uma nova."
            : "Não foi possível abrir a mesa. Procure um atendente.",
          { id: "qr-error" }
        );
      }
    } catch (e) {
      console.error("TABLE_QR_SCAN_ERROR", e);
      toast.error("Falha ao sincronizar mesa. Procure um atendente.", { id: "qr-error" });
    } finally {
      setValidating(false);
      setScanning(false);
    }
  };

  return (
    <div className={className}>
      {validatedTable ? (
        <div
          role="status"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[hsl(var(--site-primary))] px-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--site-primary-fg))] shadow-[0_6px_16px_-8px_hsl(var(--site-primary)/0.8)] ring-1 ring-inset ring-white/15 sm:min-h-10 sm:px-4 sm:text-xs"
        >
          <Utensils
            className="h-[15px] w-[15px] sm:h-4 sm:w-4"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          Mesa {validatedTable.number} identificada
        </div>
      ) : (
        // Pílula pequena na cor da loja, presa no alto da capa: um selo que se
        // vê sem competir com a logo (36px no celular, 40px no computador —
        // ainda confortável para o dedo). O "aumentar ao passar o mouse" só
        // acontece para quem não pediu ao sistema para reduzir movimento.
        <button
          type="button"
          onClick={() => setScanning(true)}
          disabled={validating}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[hsl(var(--site-primary))] px-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--site-primary-fg))] shadow-[0_6px_16px_-8px_hsl(var(--site-primary)/0.8)] ring-1 ring-inset ring-white/15 transition-transform duration-200 motion-safe:hover:scale-[1.04] active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--site-primary))] focus-visible:ring-offset-[hsl(var(--site-bg))] sm:min-h-10 sm:px-4 sm:text-xs"
        >
          {validating ? (
            <Loader2 className="h-[15px] w-[15px] animate-spin sm:h-4 sm:w-4" aria-hidden="true" />
          ) : (
            <QrCode
              className="h-[15px] w-[15px] sm:h-4 sm:w-4"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          )}
          Escanear QR da mesa
        </button>
      )}

      {scanning && (
        <QrScannerSobDemanda
          onScan={handleScan}
          onClose={() => setScanning(false)}
          identifying={validating}
        />
      )}
    </div>
  );
}