import { useState } from "react";
import { Loader2, QrCode, Utensils } from "lucide-react";
import { toast } from "sonner";
import { useCart, isValidTableNumber } from "./CartContext";
import { QrScanner } from "./QrScanner";
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
    setScanning(false);

    if (sessionClosed) clearSessionClosed();

    const { restaurant_slug, table_token, table_number } = extractTableQrData(text, restaurant.slug);
    if (!table_token) {
      toast.error("QR Code de mesa inválido. Procure um atendente.", { id: "qr-error" });
      return;
    }
    if (!isValidTableNumber(table_number)) {
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
    }
  };

  return (
    <div className={className}>
      {validatedTable ? (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] font-black uppercase text-[10px] sm:text-xs shadow-lg">
          <Utensils className="h-3.5 w-3.5" />
          Mesa {validatedTable.number} identificada
        </div>
      ) : (
        <button
          onClick={() => setScanning(true)}
          disabled={validating}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] font-black uppercase text-xs tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-60"
        >
          {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          Scanear QR da Mesa
        </button>
      )}

      {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}
    </div>
  );
}