import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  Download,
  Globe,
  Rocket,
  Sparkles,
} from "lucide-react";
import { listRestaurants } from "@/lib/site/queries";
import type { RestaurantRow } from "@/lib/site/types";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/site/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SiteCreatorFly — Plataforma de sites de delivery" },
      {
        name: "description",
        content:
          "Crie sites de delivery prontos para uso, com cardápio, combos e checkout via WhatsApp.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const [list, setList] = useState<RestaurantRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const reload = () => {
    listRestaurants().then(setList).catch((e) => setError(String(e)));
  };

  useEffect(() => {
    reload();
  }, []);

  const handleCreate = async () => {
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o nome do restaurante");
      return;
    }
    let slug = slugify(trimmed);
    if (!slug) slug = `site-${Date.now()}`;
    // ensure unique
    const { data: existing } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error: insErr } = await supabase
      .from("restaurants")
      .insert({ name: trimmed, slug })
      .select()
      .single();
    if (insErr || !data) {
      setError(insErr?.message ?? "Falha ao criar");
      return;
    }
    setName("");
    setCreating(false);
    router.navigate({ to: "/edit/$id", params: { id: data.id } });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este site definitivamente?")) return;
    await supabase.from("restaurants").delete().eq("id", id);
    reload();
  };

  const togglePublished = async (r: RestaurantRow) => {
    await supabase
      .from("restaurants")
      .update({ published: !r.published })
      .eq("id", r.id);
    reload();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-black tracking-tight text-lg leading-none">
                SiteCreatorFly
              </h1>
              <p className="text-xs text-muted-foreground">
                Sites de delivery prontos para decolar
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition shadow-glow"
          >
            <Plus className="h-4 w-4" /> Novo site
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {creating && (
          <div className="mb-6 rounded-2xl border border-border bg-gradient-card p-5 shadow-card">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Criar novo site
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Ex.: Pizzaria do João"
                className="flex-1 px-4 py-2 rounded-lg bg-input border border-border focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleCreate}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition"
              >
                Criar
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setName("");
                  setError("");
                }}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition"
              >
                Cancelar
              </button>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </div>
        )}

        {list === null ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : list.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((r) => (
              <article
                key={r.id}
                className="rounded-2xl border border-border bg-gradient-card p-5 shadow-card flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {r.logo_url ? (
                      <img
                        src={r.logo_url}
                        alt={r.name}
                        className="h-12 w-12 rounded-lg object-cover bg-muted flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-gradient-primary flex-shrink-0 flex items-center justify-center font-bold text-primary-foreground">
                        {r.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{r.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        /s/{r.slug}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePublished(r)}
                    className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide ${
                      r.published
                        ? "bg-success text-success-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.published ? "publicado" : "rascunho"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  <Link
                    to="/edit/$id"
                    params={{ id: r.id }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-muted transition"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Link>
                  <Link
                    to="/s/$slug"
                    params={{ slug: r.slug }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-muted transition"
                  >
                    <Globe className="h-3.5 w-3.5" /> Ver site
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Link
                    to="/export/$id"
                    params={{ id: r.id }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-muted transition"
                  >
                    <Download className="h-3.5 w-3.5" /> Exportar
                  </Link>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-destructive hover:bg-destructive/10 transition ml-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-gradient-card p-12 text-center shadow-card">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center mb-4 shadow-glow">
        <Rocket className="h-8 w-8 text-primary-foreground" />
      </div>
      <h2 className="text-2xl font-black mb-2">Crie seu primeiro site</h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Sites de delivery completos com cardápio, combos e checkout via WhatsApp — só
        adicionar as informações da empresa.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-bold hover:opacity-90 transition shadow-glow"
      >
        <Plus className="h-5 w-5" /> Criar novo site
      </button>
    </div>
  );
}
