import { useEffect, useState } from "react";
import { Plus, Save, Trash2, MapPin, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DeliveryZoneRow } from "@/lib/site/types";
import { DEFAULT_DELIVERY_ZONES } from "@/lib/site/defaultMenu";
import { formatBRL } from "@/lib/site/format";

interface Props {
  restaurantId: string;
}

export function DeliveryZonesManager({ restaurantId }: Props) {
  const [zones, setZones] = useState<DeliveryZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [newFee, setNewFee] = useState("");
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order");
    setZones((data ?? []) as unknown as DeliveryZoneRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [restaurantId]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2000);
  };

  const handleAdd = async () => {
    const name = newName.trim().toUpperCase();
    const fee = Number(newFee.replace(",", "."));
    if (!name) return flash("Informe o nome do bairro");
    if (!Number.isFinite(fee) || fee < 0) return flash("Taxa inválida");
    const sort_order = zones.length;
    const { error } = await supabase.from("delivery_zones").insert({
      restaurant_id: restaurantId,
      neighborhood: name,
      fee,
      sort_order,
    });
    if (error) return flash("Erro: " + error.message);
    setNewName("");
    setNewFee("");
    flash("Bairro adicionado");
    load();
  };

  const handleUpdate = async (z: DeliveryZoneRow, patch: Partial<DeliveryZoneRow>) => {
    setZones((cur) => cur.map((x) => (x.id === z.id ? { ...x, ...patch } : x)));
  };

  const handleSave = async (z: DeliveryZoneRow) => {
    const { error } = await supabase
      .from("delivery_zones")
      .update({ neighborhood: z.neighborhood.toUpperCase(), fee: Number(z.fee) || 0 })
      .eq("id", z.id);
    if (error) return flash("Erro: " + error.message);
    flash("Salvo");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este bairro?")) return;
    await supabase.from("delivery_zones").delete().eq("id", id);
    load();
  };

  const handleSeedDefaults = async () => {
    if (!confirm("Adicionar bairros padrão de Salvador que ainda não existem?")) return;
    const existing = new Set(zones.map((z) => z.neighborhood.toUpperCase()));
    const rows = DEFAULT_DELIVERY_ZONES.filter(
      (d) => !existing.has(d.neighborhood.toUpperCase()),
    ).map((d, i) => ({
      restaurant_id: restaurantId,
      neighborhood: d.neighborhood,
      fee: d.fee,
      sort_order: zones.length + i,
    }));
    if (rows.length === 0) return flash("Todos os bairros padrão já estão cadastrados");
    const { error } = await supabase.from("delivery_zones").insert(rows);
    if (error) return flash("Erro: " + error.message);
    flash(`${rows.length} bairros adicionados`);
    load();
  };

  const filtered = zones.filter((z) =>
    z.neighborhood.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-card">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow flex-shrink-0">
            <MapPin className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold">Taxas de entrega por bairro</h3>
            <p className="text-sm text-muted-foreground">
              O cliente escolhe o bairro no checkout e a taxa é somada automaticamente
              ao valor do pedido antes de ir para o WhatsApp.
            </p>
          </div>
        </div>
        <button
          onClick={handleSeedDefaults}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-sm font-semibold"
        >
          <RefreshCw className="h-4 w-4" />
          Carregar bairros padrão (Salvador)
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h4 className="font-bold mb-3">Adicionar novo bairro</h4>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr,1fr,auto] gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do bairro (ex: Vitória)"
            className="input"
          />
          <input
            value={newFee}
            onChange={(e) => setNewFee(e.target.value)}
            placeholder="Taxa (ex: 15)"
            inputMode="decimal"
            className="input"
          />
          <button
            onClick={handleAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition shadow-glow"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
        {msg && <p className="text-sm text-muted-foreground mt-2">{msg}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h4 className="font-bold">Bairros cadastrados ({zones.length})</h4>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar..."
            className="input max-w-xs"
          />
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum bairro cadastrado.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((z) => (
              <div key={z.id} className="py-2 grid grid-cols-1 sm:grid-cols-[2fr,1fr,auto,auto] gap-2 items-center">
                <input
                  value={z.neighborhood}
                  onChange={(e) => handleUpdate(z, { neighborhood: e.target.value })}
                  className="input"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input
                    value={String(z.fee)}
                    onChange={(e) =>
                      handleUpdate(z, {
                        fee: Number(e.target.value.replace(",", ".")) || 0,
                      })
                    }
                    inputMode="decimal"
                    className="input flex-1"
                  />
                  <span className="text-xs text-muted-foreground min-w-[80px]">
                    {formatBRL(Number(z.fee) || 0)}
                  </span>
                </div>
                <button
                  onClick={() => handleSave(z)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-sm"
                >
                  <Save className="h-3.5 w-3.5" /> Salvar
                </button>
                <button
                  onClick={() => handleDelete(z.id)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
