import { useState, useEffect } from "react";
import { Printer, Download, QrCode, Power, PowerOff, Loader2, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { RestaurantTableRow, TableSessionRow, RestaurantRow } from "@/lib/site/types";
import { QRCodeSVG } from "qrcode.react";
import { resolveTablesUrl } from "@/lib/site/flycontrol";

interface Props {
  restaurant: RestaurantRow;
}

export function TableManager({ restaurant }: Props) {
  const [tables, setTables] = useState<RestaurantTableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"tables" | "sessions">("tables");

  const loadData = async () => {
    // Sincronização desativada no SiteCreatorFly conforme nova estratégia
    setTables([]);
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
            Mesas/QR
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
          <h4 className="font-black uppercase text-xs tracking-widest text-blue-500">Gestão Externa</h4>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
            As mesas e QR Codes são gerenciados diretamente no painel FlyControl. 
            O SiteCreatorFly identifica as mesas automaticamente através da leitura do QR Code.
          </p>
        </div>
      </div>

      {activeTab === "tables" ? (
        <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
          <QrCode className="h-12 w-12 text-white/10 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">As mesas e QR Codes são gerenciados diretamente no FlyControl.</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2">O SiteCreatorFly identifica mesas via QR Code com token e número.</p>
          <a 
            href="https://flycontrol-dash.lovable.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 btn-premium px-6 py-3 rounded-xl uppercase text-[10px] font-black tracking-widest"
          >
            Gerenciar no FlyControl <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
          <CheckCircle2 className="h-12 w-12 text-white/10 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">O monitoramento de comandas está disponível no FlyControl.</p>
          <a 
            href="https://flycontrol-dash.lovable.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 btn-premium px-6 py-3 rounded-xl uppercase text-[10px] font-black tracking-widest"
          >
            Ir para FlyControl <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}