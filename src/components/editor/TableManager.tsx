import { useState, useEffect } from "react";
import { Printer, Download, QrCode, Power, PowerOff, Loader2, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
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
      console.log("SF_TABLES_SYNC_START");
      console.log("SF_TABLES_SYNC_ENDPOINT:", tablesUrl);
      
      const response = await fetch(tablesUrl);
      console.log("SF_TABLES_SYNC_STATUS:", response.status);
      
      const rawText = await response.text();
      console.log("SF_TABLES_SYNC_RAW_RESPONSE:", rawText);

      if (!response.ok) throw new Error("Erro ao buscar mesas no FlyControl");
      
      const tablesData = JSON.parse(rawText);
      console.log("SF_TABLES_SYNC_JSON_RESPONSE:", tablesData);
      console.log("SF_TABLES_SYNC_COUNT:", (tablesData || []).length);
      
      // Mapear dados para o formato esperado pelo componente
      const mappedTables = (tablesData || []).map((t: any, idx: number) => ({
        id: t.id || `table-${idx}`,
        table_number: t.table_number,
        table_name: t.table_name,
        public_token: t.public_token,
        is_active: t.is_active !== false,
      }));

      setTables(mappedTables);
      setSessions([]); // No SF as sessões são apenas para consulta, mas no momento FlyControl gerencia isso
    } catch (err: any) {
      console.error("SF_TABLES_SYNC_ERROR:", err);
      toast.error("Falha ao sincronizar mesas com FlyControl", { id: "sync-error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [restaurant.id]);

  const getTableUrl = (token: string) => {
    const slug = restaurant.slug || "restaurante";
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
          Sincronizando com FlyControl...
        </p>
      </div>
    );
  }

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
            Mesas Importadas
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === "sessions" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monitoramento
          </button>
        </div>

        <div className="flex items-center gap-2">
           <button
            onClick={loadData}
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/20 transition-all text-muted-foreground"
            title="Atualizar Mesas"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <a
            href="https://flycontrol-dash.lovable.app"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto btn-premium px-6 py-3 rounded-xl flex items-center justify-center gap-2 group"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="uppercase text-xs tracking-widest">Gerenciar no FlyControl</span>
          </a>
        </div>
      </div>

      <div className="card-premium p-6 border-blue-500/20 bg-blue-500/5 flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <QrCode className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h4 className="font-black uppercase text-xs tracking-widest text-blue-500">Sincronização Ativa</h4>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
            As mesas são gerenciadas exclusivamente no painel FlyControl. 
            Você pode imprimir os QR Codes e gerar links diretamente aqui.
          </p>
        </div>
      </div>

      {activeTab === "tables" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <QrCode className="h-12 w-12 text-white/10 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Nenhuma mesa encontrada no FlyControl.</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2">Certifique-se de ter mesas cadastradas no FlyControl.</p>
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
                    <div
                      className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                        table.is_active ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : "border-red-500/30 text-red-500 bg-red-500/5"
                      }`}
                    >
                      {table.is_active ? "Ativa" : "Inativa"}
                    </div>
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
        <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
          <CheckCircle2 className="h-12 w-12 text-white/10 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">O monitoramento de comandas está disponível no FlyControl.</p>
          <a 
            href="https://flycontrol-dash.lovable.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-primary hover:underline uppercase text-[10px] font-black tracking-widest"
          >
            Ir para FlyControl <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
