import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Loader2, AlertCircle, Zap, ZapOff } from "lucide-react";

interface Props {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  identifying?: boolean;
}

export function QrScanner({ onScan, onClose, identifying = false }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);
  const regionId = "qr-reader";

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(regionId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            try {
              if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate?.(80);
              }
            } catch {}
            onScan(decodedText);
          },
          () => {} // Uncaught error handler (ignoring noise)
        );
        try {
          const caps: any = (html5QrCode as any).getRunningTrackCapabilities?.();
          if (caps && "torch" in caps) setTorchSupported(true);
        } catch {}
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
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

  const toggleTorch = async () => {
    const inst: any = scannerRef.current;
    if (!inst) return;
    try {
      await inst.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch (e) {
      console.warn("torch toggle failed", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-hidden">
      {/* Camera fills the entire viewport */}
      <div id={regionId} className="absolute inset-0 w-full h-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover" />

      {/* Dark overlay with a transparent square cutout in the middle */}
      {!error && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(transparent 0, transparent 0), rgba(0,0,0,0.55)",
            WebkitMaskImage:
              "linear-gradient(#000,#000), linear-gradient(#000,#000)",
          }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent"
            style={{
              width: "min(78vw, 340px)",
              height: "min(78vw, 340px)",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
              borderRadius: "24px",
            }}
          />
        </div>
      )}

      {/* Reading frame with green corners + scan line */}
      {!error && !isInitializing && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ width: "min(78vw, 340px)", height: "min(78vw, 340px)" }}
        >
          {/* Four rounded green corners */}
          <span className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] rounded-tl-2xl" style={{ borderColor: "#22C55E" }} />
          <span className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] rounded-tr-2xl" style={{ borderColor: "#22C55E" }} />
          <span className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] rounded-bl-2xl" style={{ borderColor: "#22C55E" }} />
          <span className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] rounded-br-2xl" style={{ borderColor: "#22C55E" }} />

          {/* Scanning line */}
          <div className="absolute inset-x-4 top-0 h-[2px] rounded-full qr-scanline" />
        </div>
      )}

      {/* Top controls */}
      <div className="absolute top-0 inset-x-0 pt-[max(env(safe-area-inset-top),1rem)] px-5 flex items-center justify-between z-10">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="h-11 w-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {torchSupported ? (
          <button
            onClick={toggleTorch}
            aria-label="Flash"
            className={`h-11 w-11 rounded-full backdrop-blur-md flex items-center justify-center transition active:scale-95 ${
              torchOn ? "bg-white text-black" : "bg-black/50 text-white"
            }`}
          >
            {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
          </button>
        ) : (
          <div className="h-11 w-11" />
        )}
      </div>

      {/* Bottom hint */}
      {!error && (
        <div className="absolute inset-x-0 bottom-0 pb-[max(env(safe-area-inset-bottom),2rem)] flex justify-center z-10">
          <p className="text-white/85 text-sm font-medium text-center px-8">
            Aponte a câmera para o QR Code da mesa
          </p>
        </div>
      )}

      {/* Initializing */}
      {isInitializing && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3 z-20">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-xs text-white/70">Iniciando câmera…</p>
        </div>
      )}

      {/* Identifying overlay */}
      {identifying && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm gap-4 z-30">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#22C55E" }} />
          <p className="text-white text-base font-semibold">Identificando mesa…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-8 text-center gap-4 z-30">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-sm text-white max-w-xs">{error}</p>
          <button
            onClick={onClose}
            className="mt-2 px-8 py-3 rounded-full bg-white text-black text-sm font-semibold active:scale-95 transition"
          >
            Voltar
          </button>
        </div>
      )}

      <style>{`
        @keyframes qr-scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(calc(min(78vw, 340px) - 4px)); opacity: 0; }
        }
        .qr-scanline {
          background: linear-gradient(90deg, transparent, #22C55E, transparent);
          box-shadow: 0 0 12px #22C55E, 0 0 24px rgba(34,197,94,0.6);
          animation: qr-scan 2.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}