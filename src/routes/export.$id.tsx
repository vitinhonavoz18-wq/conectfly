import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Download, ExternalLink, Link as LinkIcon, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RestaurantRow } from "@/lib/site/types";

export const Route = createFileRoute("/export/$id")({
  component: ExportPage,
});

function ExportPage() {
  const { id } = Route.useParams();
  const [r, setR] = useState<RestaurantRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

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
      const [{ fetchSiteByRestaurant }, { buildProjectZip }] = await Promise.all([
        import("@/lib/site/queries"),
        import("@/lib/site/exportZip"),
      ]);
      const data = await fetchSiteByRestaurant(r);
      const blob = await buildProjectZip(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `projeto-site-completo-${r.slug || "site"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg("Download concluído!");
    } catch (e) {
      console.error("Erro ao exportar:", e);
      setMsg("Erro ao gerar o ZIP: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const shareUrl =
    r && typeof window !== "undefined"
      ? `${window.location.origin}/s/${r.slug}`
      : "";

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
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
            Baixe o <strong className="text-foreground">projeto completo</strong>{" "}
            (Vite + React + Tailwind + TypeScript) com todos os arquivos
            necessários, scripts de inicialização e a documentação técnica
            detalhada (<code className="text-foreground">DOCUMENTACAO.md</code>).
            Após o download, basta:
          </p>
          <ol className="list-decimal list-inside text-sm space-y-1 mb-8 text-muted-foreground">
            <li>Descompactar o arquivo ZIP</li>
            <li>Rodar <code className="text-foreground">npm install</code></li>
            <li>Rodar <code className="text-foreground">npm run dev</code></li>
            <li>
              Para deploy: <code className="text-foreground">npm run build</code> e
              hospedar a pasta <code className="text-foreground">dist/</code>
            </li>
            <li>
              Leia o <code className="text-foreground">DOCUMENTACAO.md</code>{" "}
              dentro do ZIP para entender toda a estrutura
            </li>
          </ol>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-bold hover:opacity-90 transition shadow-glow disabled:opacity-50"
          >
            <Download className="h-5 w-5" />
            {busy ? "Gerando..." : "Exportar Projeto (.ZIP)"}
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            Inclui: frontend completo · dados do cardápio · combos · configurações
            · <code>start.sh</code> · <code>README.md</code> ·{" "}
            <code>DOCUMENTACAO.md</code>
          </p>
          {msg && (
            <p className="text-sm text-muted-foreground mt-3">{msg}</p>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-2 text-sm font-bold">
            <LinkIcon className="h-4 w-4 text-primary" />
            Link de preview para compartilhar
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Envie ao cliente para visualizar o site antes da exportação ou conexão
            de domínio próprio.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono"
            />
            <button
              onClick={handleCopyShare}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition text-sm"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar
                </>
              )}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-muted transition text-sm font-semibold"
            >
              <ExternalLink className="h-4 w-4" /> Abrir
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}