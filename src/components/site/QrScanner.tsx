import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, Loader2, AlertCircle } from "lucide-react";

interface Props {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function QrScanner({ onScan, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "qr-reader";

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(regionId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            console.log("QR Decoded:", decodedText);
            onScan(decodedText);
          },
          () => {} // Uncaught error handler (ignoring noise)
        );
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Failed to start scanner:", err);
        setError("Não foi possível acessar a câmera. Certifique-se de dar permissão ou tente novamente.");
        setIsInitializing(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-widest text-sm">Escaneando Mesa</h3>
              <p className="text-[10px] text-white/60 uppercase tracking-widest">Aponte para o QR Code</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-square w-full rounded-[2rem] overflow-hidden border-2 border-primary/30 shadow-[0_0_50px_rgba(var(--site-primary-rgb),0.2)] bg-white/5">
          <div id={regionId} className="w-full h-full" />
          
          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-black uppercase tracking-widest text-white/60">Iniciando Câmera...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-8 text-center gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-sm font-medium text-white">{error}</p>
              <button 
                onClick={onClose}
                className="btn-premium px-8 py-3 rounded-xl uppercase text-xs tracking-widest w-full"
              >
                Voltar
              </button>
            </div>
          )}

          {!isInitializing && !error && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-primary rounded-3xl animate-pulse" />
              <div className="absolute top-0 left-0 right-0 h-1/4 bg-black/40" />
              <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-black/40" />
              <div className="absolute top-1/4 bottom-1/4 left-0 w-[calc(50%-128px)] bg-black/40" />
              <div className="absolute top-1/4 bottom-1/4 right-0 w-[calc(50%-128px)] bg-black/40" />
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-white/40 font-medium">
            O QR Code geralmente está colado<br />no centro ou canto da mesa.
          </p>
        </div>
      </div>
    </div>
  );
}