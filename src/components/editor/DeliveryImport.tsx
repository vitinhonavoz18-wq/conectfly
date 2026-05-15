import { useState, useRef } from "react";
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, X, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { DeliveryZoneRow } from "@/lib/site/types";

interface Props {
  restaurantId: string;
  onSuccess: () => void;
  existingZones: DeliveryZoneRow[];
}

interface DeliveryImportItem {
  bairro: string;
  taxa: number;
  ativo?: boolean;
}

interface ImportData {
  pizzaria?: string;
  tipo_importacao?: string;
  taxas_entrega?: DeliveryImportItem[];
}

interface ValidationResult {
  neighborhood: string;
  fee: number;
  status: "novo" | "atualizar" | "invalido";
  reason?: string;
}

export function DeliveryImport({ restaurantId, onSuccess, existingZones }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalize = (s: string) => s.trim().toUpperCase();
  const formatName = (s: string) => {
    const trimmed = s.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  };

  const validateData = (json: any) => {
    if (json.tipo_importacao !== "taxas_entrega" || !json.taxas_entrega || !Array.isArray(json.taxas_entrega)) {
      setError("O arquivo deve ser do tipo 'taxas_entrega' e conter uma lista de 'taxas_entrega'.");
      setData(null);
      setResults([]);
      return;
    }

    const validation: ValidationResult[] = json.taxas_entrega.map((item: any) => {
      const neighborhood = item.bairro?.toString() || "";
      const fee = typeof item.taxa === "number" ? item.taxa : parseFloat(item.taxa);
      
      if (!neighborhood) {
        return { neighborhood: "Nome ausente", fee: 0, status: "invalido", reason: "Bairro obrigatório" };
      }
      if (isNaN(fee)) {
        return { neighborhood, fee: 0, status: "invalido", reason: "Taxa inválida" };
      }

      const norm = normalize(neighborhood);
      const existing = existingZones.find(z => normalize(z.neighborhood) === norm);

      return {
        neighborhood: formatName(neighborhood),
        fee,
        status: existing ? "atualizar" : "novo"
      };
    });

    const hasInvalid = validation.some(v => v.status === "invalido");
    if (hasInvalid) {
      setError("Existem itens inválidos no arquivo. Verifique a prévia.");
    } else {
      setError(null);
    }

    setResults(validation);
    setData(json);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/json" && !selectedFile.name.endsWith(".json")) {
      toast.error("Por favor, selecione um arquivo JSON válido.");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        validateData(json);
      } catch (err) {
        setError("O arquivo JSON é inválido ou está malformado.");
        setData(null);
        setResults([]);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!data || !restaurantId || error) return;
    setLoading(true);

    try {
      const validResults = results.filter(r => r.status !== "invalido");
      
      for (const item of validResults) {
        const norm = normalize(item.neighborhood);
        const existing = existingZones.find(z => normalize(z.neighborhood) === norm);

        if (existing) {
          const { error: upErr } = await supabase
            .from("delivery_zones")
            .update({ 
              neighborhood: item.neighborhood.toUpperCase(), 
              fee: item.fee 
            })
            .eq("id", existing.id);
          if (upErr) throw upErr;
        } else {
          const { error: insErr } = await supabase
            .from("delivery_zones")
            .insert({
              restaurant_id: restaurantId,
              neighborhood: item.neighborhood.toUpperCase(),
              fee: item.fee,
              sort_order: existingZones.length
            });
          if (insErr) throw insErr;
        }
      }

      toast.success("Taxas de entrega importadas com sucesso.");
      setIsOpen(false);
      onSuccess();
    } catch (err: any) {
      console.error("Erro na importação:", err);
      toast.error("Não foi possível importar as taxas. Verifique o arquivo JSON e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setData(null);
    setError(null);
    setResults([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const stats = {
    new: results.filter(r => r.status === "novo").length,
    update: results.filter(r => r.status === "atualizar").length,
    invalid: results.filter(r => r.status === "invalido").length,
    free: results.filter(r => r.fee === 0 && r.status !== "invalido").length
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold transition-all">
          <FileJson className="h-4 w-4 text-primary" />
          <span>Importar Taxas por JSON</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] border-white/10 bg-zinc-950 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Importar Taxas de Entrega</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!data ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all"
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-bold">Clique para anexar o arquivo .json</p>
                <p className="text-xs text-muted-foreground mt-1 text-zinc-400">Arraste e solte o arquivo aqui</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".json" 
                className="hidden" 
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <FileJson className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-bold text-sm truncate max-w-[200px]">{file?.name}</p>
                    <p className="text-xs text-zinc-400">Pronto para validar</p>
                  </div>
                </div>
                <button onClick={reset} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Novos</p>
                  <p className="text-xl font-black text-emerald-400">{stats.new}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Atualizar</p>
                  <p className="text-xl font-black text-blue-400">{stats.update}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Inválidos</p>
                  <p className="text-xl font-black text-destructive">{stats.invalid}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Taxa Zero</p>
                  <p className="text-xl font-black text-amber-400">{stats.free}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden bg-white/5">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white/10 text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                    <tr>
                      <th className="p-3">Bairro</th>
                      <th className="p-3">Taxa</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {results.slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="p-3 font-medium">{r.neighborhood}</td>
                        <td className="p-3 text-emerald-400 font-bold">R$ {r.fee.toFixed(2)}</td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            r.status === 'novo' ? 'bg-emerald-500/10 text-emerald-500' :
                            r.status === 'atualizar' ? 'bg-blue-500/10 text-blue-500' :
                            'bg-destructive/10 text-destructive'
                          }`}>
                            {r.status === 'novo' ? 'Novo' : r.status === 'atualizar' ? 'Atualizar' : 'Inválido'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.length > 50 && (
                  <div className="p-2 text-center text-[10px] text-zinc-500 bg-black/20">
                    Mostrando 50 de {results.length} bairros...
                  </div>
                )}
              </div>

              {stats.free > 0 && (
                <div className="text-[11px] text-zinc-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex gap-2">
                  <Info className="h-4 w-4 shrink-0 text-amber-500" />
                  <p>Existem {stats.free} bairros com taxa zero (Grátis/Retirada).</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex gap-3 items-center text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 px-6 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-sm font-bold transition-all"
          >
            Cancelar
          </button>
          <button
            disabled={!data || loading || !!error}
            onClick={handleImport}
            className="flex-1 btn-premium px-6 py-3 rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest shadow-xl disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>Confirmar Importação</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
