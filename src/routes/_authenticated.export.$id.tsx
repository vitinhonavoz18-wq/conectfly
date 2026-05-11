import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FolderTree,
  Github,
  Globe,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  Lock,
  Package,
  Server,
  Unlock,
  UploadCloud,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPizzeriaPublicUrl } from "@/lib/site/format";
import type { RestaurantRow } from "@/lib/site/types";
import {
  FLYCONTROL_EDGE_FUNCTION_TS,
  FLYCONTROL_CREATE_PIZZERIA_TS,
  FLYCONTROL_SCHEMA_SQL,
} from "@/lib/site/flycontrolEdgeFunction";

export const Route = createFileRoute("/export/$id")({
  component: ExportPage,
});

function ExportPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [r, setR] = useState<RestaurantRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // GitHub push state
  const [ghToken, setGhToken] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghPrivate, setGhPrivate] = useState(true);
  const [ghBusy, setGhBusy] = useState(false);
  const [ghMsg, setGhMsg] = useState("");
  const [ghResult, setGhResult] = useState<{ repoUrl: string; branch: string; filesCount: number } | null>(null);

  useEffect(() => {
    supabase
      .from("restaurants")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as unknown as RestaurantRow | null;
        setR(row);
        if (row && !ghRepo) setGhRepo(row.slug || "site-delivery");
      });
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

  const shareUrl = r ? getPizzeriaPublicUrl(r.slug) : "";

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

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleGithubPush = async () => {
    if (!r) return;
    setGhResult(null);
    if (!ghToken.trim()) {
      setGhMsg("Informe seu Personal Access Token do GitHub.");
      return;
    }
    const repoName = ghRepo.trim().replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 90);
    if (!repoName) {
      setGhMsg("Informe um nome válido para o repositório.");
      return;
    }
    setGhBusy(true);
    setGhMsg("Iniciando...");
    try {
      const [{ fetchSiteByRestaurant }, { pushProjectToGithub }] = await Promise.all([
        import("@/lib/site/queries"),
        import("@/lib/site/githubPush"),
      ]);
      const data = await fetchSiteByRestaurant(r);
      const result = await pushProjectToGithub(data, {
        token: ghToken.trim(),
        repoName,
        isPrivate: ghPrivate,
        onProgress: setGhMsg,
      });
      setGhResult(result);
      setGhMsg(`${result.filesCount} arquivos enviados para a branch ${result.branch}.`);
      setGhToken(""); // limpa o token imediatamente após uso
    } catch (e) {
      console.error("[github push]", e);
      setGhMsg("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGhBusy(false);
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
            O ZIP contém uma pasta com{" "}
            <strong className="text-foreground">100% do código-fonte</strong> do
            site, pronta para você hospedar em qualquer servidor e conectar um{" "}
            <strong className="text-foreground">domínio externo próprio</strong>{" "}
            (Vercel, Netlify, Cloudflare Pages, Hostinger, AWS, etc.).
          </p>

          <div className="rounded-xl border border-border bg-muted/30 p-4 mb-6 font-mono text-xs leading-relaxed">
            <div className="flex items-center gap-2 mb-2 text-foreground font-sans font-bold text-sm">
              <FolderTree className="h-4 w-4 text-primary" />
              Estrutura da pasta exportada
            </div>
            <pre className="text-muted-foreground whitespace-pre overflow-x-auto">{`projeto-site-completo-${r.slug || "site"}/
├── src/
│   ├── components/      → todos os componentes do site
│   ├── context/         → carrinho de pedidos
│   ├── data/            → cardápio, combos, infos
│   ├── lib/             → utilitários
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── start.sh             → instala e roda em 1 comando
├── README.md
└── DOCUMENTACAO.md      → manual completo`}</pre>
          </div>

          <p className="text-sm font-semibold mb-2">Como usar após o download:</p>
          <ol className="list-decimal list-inside text-sm space-y-1 mb-8 text-muted-foreground">
            <li>Descompactar o arquivo ZIP</li>
            <li>Rodar <code className="text-foreground">npm install</code></li>
            <li>Rodar <code className="text-foreground">npm run dev</code></li>
            <li>
              Para hospedagem + domínio externo:{" "}
              <code className="text-foreground">npm run build</code> e fazer
              upload da pasta <code className="text-foreground">dist/</code> em
              qualquer hospedagem estática
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

        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2 text-sm font-bold">
              <Server className="h-4 w-4 text-primary" />
              Hospedagem livre
            </div>
            <p className="text-xs text-muted-foreground">
              Hospede o site em qualquer provedor: Vercel, Netlify, Cloudflare
              Pages, Hostinger, GitHub Pages, AWS S3, Render, etc. Por ser
              estático (Vite build), funciona em praticamente qualquer servidor.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2 text-sm font-bold">
              <Globe className="h-4 w-4 text-primary" />
              Domínio externo próprio
            </div>
            <p className="text-xs text-muted-foreground">
              Cada projeto exportado é independente. Conecte seu próprio
              domínio (ex: <code>seurestaurante.com.br</code>) diretamente na
              hospedagem escolhida — sem nenhum vínculo com a plataforma.
            </p>
          </div>
        </div>

        {/* ================ FLYCONTROL section ================ */}
        <div className="mt-6 rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="font-bold">Integração FLYCONTROL</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Esta pizzaria já está pronta para enviar pedidos em tempo real para o painel FLYCONTROL.
            Configure a URL e a API Key na aba <strong>Informações</strong> do editor.
            Cada site (preview e exportado) usa essa mesma configuração.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 text-xs mb-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-muted-foreground mb-1">Status</div>
              <div className="font-bold">
                {r.flycontrol_enabled ? "🟢 Ativo" : "⚪ Desativado"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-muted-foreground mb-1">API Key</div>
              <div className="font-mono break-all">
                {r.flycontrol_api_key
                  ? r.flycontrol_api_key.slice(0, 12) + "…"
                  : "—"}
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold mb-2">Templates para o projeto FLYCONTROL:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                downloadText("create-order.ts", FLYCONTROL_EDGE_FUNCTION_TS)
              }
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-sm transition"
            >
              <Download className="h-4 w-4" /> Edge Function (Deno)
            </button>
            <button
              onClick={() =>
                downloadText("create-pizzeria.ts", FLYCONTROL_CREATE_PIZZERIA_TS)
              }
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-sm transition"
            >
              <Download className="h-4 w-4" /> Edge Function — create-pizzeria
            </button>
            <button
              onClick={() => downloadText("flycontrol-schema.sql", FLYCONTROL_SCHEMA_SQL)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-sm transition"
            >
              <Download className="h-4 w-4" /> Schema SQL (pizzerias + orders)
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            No FLYCONTROL: rode o SQL, crie as funções <code>create-pizzeria</code>{" "}
            e <code>create-order</code> com os arquivos baixados, e assine{" "}
            <code>orders</code> filtrando por <code>tenant_id</code> via Supabase
            Realtime. Depois, no editor desta pizzaria, informe a URL base do
            FLYCONTROL e clique em <em>Registrar pizzaria no FLYCONTROL</em>.
          </p>
        </div>

        {/* ================ GitHub section ================ */}
        <div className="mt-6 rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-foreground flex items-center justify-center flex-shrink-0">
              <Github className="h-6 w-6 text-background" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Conectar ao GitHub</h3>
              <p className="text-sm text-muted-foreground">
                Envie o projeto diretamente para um repositório GitHub — pronto para
                conectar hospedagem (Vercel, Netlify, Cloudflare Pages) e domínio
                próprio em poucos cliques.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-4 text-xs text-amber-200 flex items-start gap-2">
            <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Como gerar um Personal Access Token (recomendado: clássico — mais simples):</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>
                  Acesse{" "}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=SiteCreatorFly"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-mono"
                  >
                    github.com/settings/tokens/new
                  </a>
                  {" "}(Tokens classic).
                </li>
                <li>Em <em>Select scopes</em> marque apenas <strong>repo</strong> (dá leitura e escrita nos seus repositórios).</li>
                <li>Defina uma expiração (ex: 30 dias), clique em <strong>Generate token</strong> e copie (começa com <code>ghp_…</code>).</li>
                <li>Cole abaixo. O token é usado uma vez e NÃO é salvo pela plataforma.</li>
              </ol>
              <p className="mt-2 text-[11px] opacity-80">
                Se preferir fine-grained (<code>github_pat_…</code>): em <em>Repository access</em> selecione o repositório alvo (ou All), e em <em>Repository permissions</em> marque <strong>Contents: Read and write</strong>, <strong>Administration: Read and write</strong> e <strong>Metadata: Read-only</strong>. Tokens fine-grained em repositórios de organização precisam ser aprovados pelo admin da org.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-xs font-semibold block mb-1">
                Personal Access Token *
              </span>
              <input
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                placeholder="github_pat_..."
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold block mb-1">
                Nome do repositório
              </span>
              <input
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                placeholder="meu-site-pizzaria"
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono"
              />
            </label>
          </div>

          <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm mb-4">
            <button
              type="button"
              onClick={() => setGhPrivate(true)}
              className={`px-3 py-1.5 inline-flex items-center gap-1.5 transition ${
                ghPrivate
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-muted"
              }`}
            >
              <Lock className="h-3.5 w-3.5" /> Privado
            </button>
            <button
              type="button"
              onClick={() => setGhPrivate(false)}
              className={`px-3 py-1.5 inline-flex items-center gap-1.5 transition ${
                !ghPrivate
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-muted"
              }`}
            >
              <Unlock className="h-3.5 w-3.5" /> Público
            </button>
          </div>

          <button
            onClick={handleGithubPush}
            disabled={ghBusy}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-foreground text-background font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {ghBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Enviando...
              </>
            ) : (
              <>
                <UploadCloud className="h-5 w-5" /> Salvar projeto no GitHub
              </>
            )}
          </button>

          {ghMsg && (
            <p className="text-xs text-muted-foreground mt-3 break-words">{ghMsg}</p>
          )}

          {ghResult && (
            <div className="mt-4 rounded-xl border border-success/40 bg-success/10 p-4">
              <div className="flex items-center gap-2 mb-2 text-sm font-bold">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Projeto enviado com sucesso!
              </div>
              <a
                href={ghResult.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-mono"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {ghResult.repoUrl}
              </a>
              <p className="text-xs text-muted-foreground mt-2">
                Próximo passo: acesse Vercel/Netlify → <em>Import Git Repository</em> →
                selecione este repo. O deploy é automático e você pode conectar seu
                domínio próprio logo em seguida.
              </p>
            </div>
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