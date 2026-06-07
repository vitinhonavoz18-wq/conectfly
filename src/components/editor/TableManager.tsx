import { useState, useEffect } from "react";
import { Plus, Trash2, Printer, Download, QrCode, Power, PowerOff, Loader2, ChevronRight, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RestaurantTableRow, TableSessionRow, RestaurantRow } from "@/lib/site/types";
import { QRCodeSVG } from "qrcode.react";
import { formatBRL } from "@/lib/site/format";
import { resolveTablesUrl } from "@/lib/site/flycontrol";

interface Props {
  restaurant: RestaurantRow;
}

export function TableManager({ restaurant }: Props) {
  const [tables, setTables] = useState<RestaurantTableRow[]>([]);
  const [sessions, setSessions] = useState<TableSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [activeTab, setActiveTab] = useState<"tables" | "sessions">("tables");

  const loadData = async () => {
    setLoading(true);
    try {
      const endpointBase = resolveTablesUrl(restaurant);
      
      if (!endpointBase) {
        console.warn("[TableManager] URL FlyControl não configurada para carregar mesas.");
        setTables([]);
        setSessions([]);
        return;
      }

      const tablesUrl = `${endpointBase}/restaurant-tables?restaurant_slug=${restaurant.slug}`;
      console.log("[TableManager] Carregando mesas via:", tablesUrl);
      
      const response = await fetch(tablesUrl);
      if (!response.ok) throw new Error("Erro ao buscar mesas no FlyControl");
      
      const tablesData = await response.json();
      
      // Mapear dados para o formato esperado pelo componente
      const mappedTables = (tablesData || []).map((t: any, idx: number) => ({
        id: t.id || `table-${idx}`,
        table_number: t.table_number,
        table_name: t.table_name,
        public_token: t.public_token,
        is_active: t.is_active !== false,
        qr_code_url: t.qr_code_url
      }));

      setTables(mappedTables);
      
      // Carregar sessões localmente (se ainda forem usadas no SF) ou via endpoint se disponível
      // Por enquanto mantemos a consulta local para sessões se necessário, ou deixamos vazio
      setSessions([]); 
    } catch (err: any) {
      console.error("[TableManager] Erro ao carregar dados:", err);
      toast.error("Erro ao carregar mesas do FlyControl");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [restaurant.id]);

  const handleAddTable = async () => {
    if (!newTableNumber.trim()) {
      toast.error("Informe o número da mesa");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .insert({
          restaurant_id: restaurantId,
          table_number: newTableNumber,
          table_name: newTableName || null,
        })
        .select()
        .single();

      if (error) throw error;

      setTables([...tables, data].sort((a, b) => a.table_number.localeCompare(b.table_number)));
      setIsAdding(false);
      setNewTableNumber("");
      setNewTableName("");
      toast.success("Mesa adicionada com sucesso!");
    } catch (err: any) {
      if (err.code === "23505") {
        toast.error("Já existe uma mesa com este número");
      } else {
        toast.error("Erro ao adicionar mesa");
      }
    }
  };

  const handleToggleActive = async (table: RestaurantTableRow) => {
    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ is_active: !table.is_active })
        .eq("id", table.id);

      if (error) throw error;

      setTables(tables.map(t => t.id === table.id ? { ...t, is_active: !t.is_active } : t));
      toast.success(`Mesa ${table.is_active ? 'desativada' : 'ativada'} com sucesso`);
    } catch (err) {
      toast.error("Erro ao atualizar mesa");
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta mesa?")) return;

    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setTables(tables.filter(t => t.id !== id));
      toast.success("Mesa excluída");
    } catch (err) {
      toast.error("Erro ao excluir mesa");
    }
  };

  const handleCloseSession = async (session: TableSessionRow) => {
    if (!confirm(`Deseja fechar a comanda da Mesa ${session.table_number}?`)) return;

    try {
      const { error } = await supabase
        .from("table_sessions")
        .update({ 
          status: "closed",
          closed_at: new Date().toISOString()
        })
        .eq("id", session.id);

      if (error) throw error;

      setSessions(sessions.filter(s => s.id !== session.id));
      toast.success(`Mesa ${session.table_number} fechada com sucesso!`);
    } catch (err) {
      toast.error("Erro ao fechar mesa");
    }
  };

  const getTableUrl = (token: string) => {
    // A URL deve seguir o padrão oficial para ser reconhecida no cardápio público
    const baseUrl = window.location.origin;
    // Se o restaurantSlug vier como "conectfly", tentamos extrair da URL ou usar um fallback
    const slug = restaurantSlug || "restaurante";
    return `https://conectfly.com.br/${slug}?mode=table&table_token=${token}`;
  };

  const printQrCode = (table: RestaurantTableRow) => {
    const url = getTableUrl(table.public_token);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - Mesa ${table.table_number}</title>
          <style>
            body { 
              font-family: sans-serif; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              text-align: center;
            }
            .container { 
              border: 2px solid #000; 
              padding: 40px; 
              border-radius: 20px;
              max-width: 300px;
            }
            h1 { margin-bottom: 10px; font-size: 24px; }
            p { color: #666; margin-bottom: 30px; }
            .footer { margin-top: 30px; font-size: 12px; color: #999; }
            img { width: 250px; height: 250px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>MESA ${table.table_number}</h1>
            <p>Escaneie para fazer seu pedido</p>
            <div id="qrcode"></div>
            <div class="footer">SiteCreatorFly</div>
          </div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <script>
            new QRCode(document.getElementById("qrcode"), "${url}");
            setTimeout(() => { window.print(); window.close(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium uppercase tracking-widest text-[10px]">
          Sincronizando Mesas...
        </p>
      </div>
    );
  }

  // SF_TABLES_LOAD_DEBUG
  console.log("SF_TABLES_LOAD_DEBUG:", {
    restaurant_id: restaurantId,
    restaurant_slug: restaurantSlug,
    quantidade_mesas: tables.length,
    fonte: "restaurant_tables (Supabase)",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab("tables")}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === "tables" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Configurar Mesas
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === "sessions" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Comandas Abertas
            {sessions.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">{sessions.length}</span>
            )}
          </button>
        </div>

        {activeTab === "tables" && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="w-full sm:w-auto btn-premium px-6 py-3 rounded-xl flex items-center justify-center gap-2 group"
          >
            <Plus className={`h-4 w-4 transition-transform ${isAdding ? "rotate-45" : ""}`} />
            <span className="uppercase text-xs tracking-widest">{isAdding ? "Cancelar" : "Nova Mesa"}</span>
          </button>
        )}
      </div>

      {isAdding && activeTab === "tables" && (
        <div className="card-premium p-6 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mb-2 block">Número da Mesa *</label>
              <input
                type="text"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                placeholder="Ex: 01, 10, A1"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 outline-none font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mb-2 block">Nome Opcional</label>
              <input
                type="text"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Ex: Varanda, Área Externa"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 outline-none font-bold"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAddTable}
              className="btn-premium px-8 py-3 rounded-xl uppercase text-xs tracking-widest"
            >
              Salvar Mesa
            </button>
          </div>
        </div>
      )}

      {activeTab === "tables" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <QrCode className="h-12 w-12 text-white/10 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Nenhuma mesa cadastrada ainda.</p>
            </div>
          ) : (
            tables.map((table) => (
              <div 
                key={table.id}
                className={`card-premium p-6 flex flex-col gap-4 group transition-all ${!table.is_active ? "opacity-60 grayscale" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-bronze flex items-center justify-center font-black text-lg text-primary-foreground shadow-glow">
                      {table.table_number}
                    </div>
                    <div>
                      <h4 className="font-black uppercase tracking-tight text-foreground">
                        Mesa {table.table_number}
                      </h4>
                      {table.table_name && (
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{table.table_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggleActive(table)}
                      className={`p-2 rounded-lg transition-colors ${table.is_active ? "text-emerald-500 hover:bg-emerald-500/10" : "text-red-500 hover:bg-red-500/10"}`}
                      title={table.is_active ? "Desativar Mesa" : "Ativar Mesa"}
                    >
                      {table.is_active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteTable(table.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir Mesa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform cursor-pointer" onClick={() => printQrCode(table)}>
                  <QRCodeSVG 
                    value={getTableUrl(table.public_token)} 
                    size={140}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => printQrCode(table)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
                  >
                    <Printer className="h-3 w-3" /> Imprimir
                  </button>
                  <button
                    onClick={() => {
                      const url = getTableUrl(table.public_token);
                      navigator.clipboard.writeText(url);
                      toast.success("Link da mesa copiado!");
                    }}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-muted-foreground"
                    title="Copiar Link"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <CheckCircle2 className="h-12 w-12 text-white/10 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Não há comandas abertas no momento.</p>
            </div>
          ) : (
            sessions.map((session: any) => (
              <div key={session.id} className="card-premium p-6 border-emerald-500/20 bg-emerald-500/5 group hover:border-emerald-500/40 transition-all">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center font-black text-2xl text-white shadow-[0_0_20px_oklch(0.7_0.2_160_/_0.3)]">
                      {session.table_number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xl font-black uppercase tracking-tight">Mesa {session.table_number}</h4>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-[10px] text-emerald-500 font-black uppercase tracking-widest border border-emerald-500/20">Aberta</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Iniciada às {new Date(session.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {session.table_session_orders?.length || 0} pedidos
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Total Acumulado</p>
                    <p className="text-2xl font-black text-emerald-500">{formatBRL(session.total_amount)}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/5">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleCloseSession(session)}
                      className="flex-1 sm:flex-none btn-premium px-8 py-3 rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest bg-emerald-600 hover:bg-emerald-500"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Fechar Mesa
                    </button>
                    <button
                      className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest font-bold"
                    >
                      <Printer className="h-4 w-4" /> Resumo
                    </button>
                    <button
                      className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-muted-foreground"
                      title="Ver Detalhes"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}