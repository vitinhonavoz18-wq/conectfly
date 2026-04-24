import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantRow } from "@/lib/site/types";
import { fetchSiteByRestaurant } from "@/lib/site/queries";
import { buildProjectZip } from "@/lib/site/exportZip";

export const Route = createFileRoute("/export/$id")({
  component: ExportPage,
});

function ExportPage() {
  const { id } = Route.useParams();
  const [r, setR] = useState<RestaurantRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase
      .from("restaurants")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setR(data as unknown as RestaurantRow | null));
  }, [id]);

  const handleDownload = async () => {
    if (!r) return;
    setBusy(true);
    setMsg("Empacotando projeto...");
    try {
      const data = await fetchSiteByRestaurant(r);
      const blob = await buildProjectZip(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r.slug || "site"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Download concluído!");
    } catch (e) {
      setMsg("Erro: " + String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!r) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-bold">Exportar projeto</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-2xl border border-border bg-gradient-card shadow-card p-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
            <Package className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-black mb-2">{r.name}</h2>
          <p className="text-muted-foreground mb-6">
            Baixe o código-fonte completo do site (Vite + React + Tailwind +
            TypeScript). Após o download, basta:
          </p>
          <ol className="list-decimal list-inside text-sm space-y-1 mb-8 text-muted-foreground">
            <li>Descompactar o arquivo ZIP</li>
            <li>Rodar <code className="text-foreground">npm install</code></li>
            <li>Rodar <code className="text-foreground">npm run dev</code></li>
            <li>
              Para deploy: <code className="text-foreground">npm run build</code> e
              hospedar a pasta <code className="text-foreground">dist/</code>
            </li>
          </ol>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-bold hover:opacity-90 transition shadow-glow disabled:opacity-50"
          >
            <Download className="h-5 w-5" />
            {busy ? "Gerando..." : "Baixar projeto (.zip)"}
          </button>
          {msg && (
            <p className="text-sm text-muted-foreground mt-3">{msg}</p>
          )}
        </div>
      </main>
    </div>
  );
}