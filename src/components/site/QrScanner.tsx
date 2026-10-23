import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Loader2, AlertCircle, Zap, ZapOff, ImageUp, RotateCcw } from "lucide-react";
import { MENSAGEM_DA_FALHA, tipoDaFalha, type FalhaDaCamera } from "@/lib/site/falhaDaCamera";

interface Props {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  identifying?: boolean;
}

const REGIAO_DA_CAMERA = "qr-reader";

/**
 * A largura, em pontos, em que o vídeo da câmera é montado na página.
 *
 * O leitor recorta a imagem no tamanho em que o vídeo aparece montado. Antes
 * o vídeo era esticado para caber na tela do celular (390 pontos de largura,
 * altura da tela inteira): o recorte saía pequeno e AMASSADO — a largura
 * comprimida 3x e a altura quase nada — e o QR chegava ao leitor como uma
 * foto achatada. Agora o vídeo é montado grande e na proporção certa, e só
 * depois é ampliado ou reduzido por inteiro para cobrir a tela. O leitor vê o
 * QR nítido e sem distorção; o cliente vê a câmera em tela cheia, como antes.
 */
const LARGURA_DO_VIDEO = 1280;
const REGIAO_DA_FOTO = "qr-reader-foto";

/**
 * Só QR Code. Sem isso, o leitor testa cada quadro contra uma dúzia de tipos
 * de código de barras que nunca vão aparecer numa mesa — trabalho jogado fora
 * no celular do cliente.
 */
const CONFIG_DO_LEITOR = {
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  // Leitor nativo do aparelho (Android, Chrome, Safari recentes): lê mais
  // rápido e com o QR mais longe ou torto. Onde não existe, o leitor comum
  // assume sozinho.
  useBarCodeDetectorIfSupported: true,
  experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  verbose: false,
};

/** O quadrado de mira: cabe no celular em pé e no notebook deitado. */
const MOLDURA = "min(78vw, 58vh, 340px)";

/**
 * A TELA DA CÂMERA que lê o QR Code da mesa.
 *
 * - Pede a câmera traseira em alta resolução: QR pequeno ou impresso longe
 *   continua legível, como ler a placa da mesa sem precisar se debruçar.
 * - Lê o quadro inteiro, não só o quadrado do meio. A moldura é a mira para
 *   o cliente; o leitor aceita o QR mesmo um pouco fora dela.
 * - Quando a câmera não abre, diz o PORQUÊ e oferece o que fazer: tentar de
 *   novo ou enviar uma foto do QR (o caminho do computador sem câmera).
 * - Esc fecha, a página de trás não rola, e a câmera é desligada de verdade
 *   ao sair — a luzinha dela não fica acesa depois.
 */
export function QrScanner({ onScan, onClose, identifying = false }: Props) {
  const [falha, setFalha] = useState<FalhaDaCamera | null>(null);
  const [iniciando, setIniciando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [avisoDaFoto, setAvisoDaFoto] = useState<string | null>(null);
  const [lendoFoto, setLendoFoto] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const regiaoRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  // Quem abre a câmera passa funções novas a cada atualização da tela. Se a
  // câmera dependesse delas, reiniciaria no meio da leitura (por exemplo,
  // quando aparece "Identificando mesa…"). Guardadas aqui, a câmera só
  // reinicia quando o cliente pede "Tentar novamente".
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  });

  const entregar = useCallback((texto: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    try {
      navigator.vibrate?.(80);
    } catch {
      // Vibrar é enfeite: aparelho sem vibração segue normalmente.
    }
    onScanRef.current(texto);
  }, []);

  // Liga a câmera (de novo a cada "Tentar novamente").
  useEffect(() => {
    let ativo = true;
    setIniciando(true);
    setFalha(null);
    scannedRef.current = false;

    const leitor = new Html5Qrcode(REGIAO_DA_CAMERA, CONFIG_DO_LEITOR);
    scannerRef.current = leitor;

    leitor
      .start(
        { facingMode: "environment" },
        {
          fps: 15,
          // A área lida é um quadrado no centro do vídeo, em resolução cheia
          // (ver LARGURA_DO_VIDEO): sobra QR de verdade para o leitor.
          qrbox: (w: number, h: number) => {
            const lado = Math.floor(Math.min(w, h) * 0.75);
            return { width: lado, height: lado };
          },
          // Com `videoConstraints`, é ele que manda: câmera traseira quando
          // houver (no notebook, a webcam que existir) e em alta resolução.
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        (texto) => entregar(texto),
        () => {
          // Quadro sem QR: normal enquanto o cliente mira. Nada a fazer.
        },
      )
      .then(async () => {
        if (!ativo) return;
        try {
          const caps = leitor.getRunningTrackCapabilities() as MediaTrackCapabilities & {
            torch?: boolean;
            focusMode?: string[];
          };
          if (caps && "torch" in caps) setTorchSupported(true);
          // Foco contínuo, quando a câmera tem: o QR fica nítido sozinho ao
          // aproximar ou afastar o celular.
          if (caps?.focusMode?.includes("continuous")) {
            await leitor.applyVideoConstraints({
              advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            });
          }
        } catch {
          // Lanterna e foco são extras; sem eles a leitura funciona igual.
        }
        ajustarEscala();
        setIniciando(false);
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        console.error("Falha ao abrir a câmera:", err);
        setFalha(tipoDaFalha(err, typeof window === "undefined" || window.isSecureContext));
        setIniciando(false);
      });

    // Amplia o vídeo inteiro (sem esticar) até cobrir a tela, como a câmera
    // do celular faz. A conta refaz ao girar o aparelho ou mudar a janela.
    function ajustarEscala() {
      const video = regiaoRef.current?.querySelector("video");
      if (!ativo || !video || !video.clientWidth || !video.clientHeight) return;
      setEscala(
        Math.max(window.innerWidth / video.clientWidth, window.innerHeight / video.clientHeight),
      );
    }
    window.addEventListener("resize", ajustarEscala);

    return () => {
      ativo = false;
      window.removeEventListener("resize", ajustarEscala);
      setTorchOn(false);
      setTorchSupported(false);
      const parar = leitor.isScanning ? leitor.stop() : Promise.resolve();
      parar
        .then(() => leitor.clear())
        .catch(() => {
          // Já estava parada: nada a desligar.
        });
    };
  }, [tentativa, entregar]);

  // Esc fecha; a página de trás não rola enquanto a câmera está aberta.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fecharRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  const toggleTorch = async () => {
    const inst = scannerRef.current;
    if (!inst) return;
    try {
      await inst.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch (e) {
      console.warn("torch toggle failed", e);
    }
  };

  // Lê o QR de uma foto. Um leitor separado, porque o da câmera não aceita
  // ler arquivo enquanto está filmando.
  const lerFoto = async (arquivo: File) => {
    setAvisoDaFoto(null);
    setLendoFoto(true);
    const leitorDeFoto = new Html5Qrcode(REGIAO_DA_FOTO, CONFIG_DO_LEITOR);
    try {
      const texto = await leitorDeFoto.scanFile(arquivo, false);
      entregar(texto);
    } catch {
      setAvisoDaFoto("Não encontramos um QR Code nessa foto. Tente outra, mais de perto e nítida.");
    } finally {
      try {
        leitorDeFoto.clear();
      } catch {
        // Nada para limpar.
      }
      setLendoFoto(false);
    }
  };

  const mensagem = falha ? MENSAGEM_DA_FALHA[falha] : null;

  const botaoDeFoto = (
    <button
      type="button"
      onClick={() => fotoRef.current?.click()}
      disabled={lendoFoto}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/15 px-5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur-md transition active:scale-95 hover:bg-white/25 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {lendoFoto ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <ImageUp className="h-4 w-4" aria-hidden="true" />
      )}
      Enviar foto do QR
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escanear QR Code da mesa"
      className="fixed inset-0 z-[100] overflow-hidden bg-black"
      style={{ ["--moldura" as string]: MOLDURA }}
    >
      {/* A imagem da câmera ocupa a tela inteira. */}
      <div
        ref={regiaoRef}
        id={REGIAO_DA_CAMERA}
        className="absolute left-1/2 top-1/2 [&_video]:block"
        style={{
          width: `${LARGURA_DO_VIDEO}px`,
          transform: `translate(-50%, -50%) scale(${escala})`,
          transformOrigin: "center",
        }}
      />
      {/* Onde a foto enviada é lida — invisível. */}
      <div id={REGIAO_DA_FOTO} className="hidden" aria-hidden="true" />
      <input
        ref={fotoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (arquivo) void lerFoto(arquivo);
        }}
      />

      {/* Escurece em volta e deixa o quadrado de mira aberto. */}
      {!falha && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "var(--moldura)",
              height: "var(--moldura)",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              borderRadius: "24px",
            }}
          />
        </div>
      )}

      {/* Moldura com cantos verdes + linha de leitura. */}
      {!falha && !iniciando && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: "var(--moldura)", height: "var(--moldura)" }}
          aria-hidden="true"
        >
          <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-[#22C55E]" />
          <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-[3px] border-t-[3px] border-[#22C55E]" />
          <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-[#22C55E]" />
          <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-[#22C55E]" />
          <div className="qr-scanline absolute inset-x-4 top-0 h-[2px] rounded-full" />
        </div>
      )}

      {/* Topo: fechar e lanterna. */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1rem)]">
        <button
          ref={fecharRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar a câmera"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition active:scale-95 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {torchSupported ? (
          <button
            type="button"
            onClick={toggleTorch}
            aria-label={torchOn ? "Desligar lanterna" : "Ligar lanterna"}
            aria-pressed={torchOn}
            className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              torchOn ? "bg-white text-black" : "bg-black/50 text-white"
            }`}
          >
            {torchOn ? (
              <Zap className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ZapOff className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <div className="h-11 w-11" />
        )}
      </div>

      {/* Rodapé: instrução + foto, para quem preferir ou estiver no computador. */}
      {!falha && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-6 pb-[max(env(safe-area-inset-bottom),2rem)] text-center">
          <p className="text-base font-semibold text-white drop-shadow">
            Aponte a câmera para o QR Code da mesa
          </p>
          {avisoDaFoto && (
            <p
              role="alert"
              className="max-w-sm rounded-xl bg-black/60 px-4 py-2 text-sm text-amber-200"
            >
              {avisoDaFoto}
            </p>
          )}
          {botaoDeFoto}
        </div>
      )}

      {/* Ligando a câmera. */}
      {iniciando && !falha && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70">
          <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden="true" />
          <p className="text-sm text-white/80" role="status">
            Abrindo a câmera…
          </p>
        </div>
      )}

      {/* Mesa sendo conferida. */}
      {identifying && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/75 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-[#22C55E]" aria-hidden="true" />
          <p className="text-base font-semibold text-white" role="status">
            Identificando mesa…
          </p>
        </div>
      )}

      {/* A câmera não abriu: o porquê e o que fazer. */}
      {mensagem && !identifying && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" aria-hidden="true" />
          <div role="alert" className="max-w-sm space-y-2">
            <p className="text-lg font-bold text-white">{mensagem.titulo}</p>
            <p className="text-sm text-white/75">{mensagem.dica}</p>
          </div>
          {avisoDaFoto && <p className="max-w-sm text-sm text-amber-200">{avisoDaFoto}</p>}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            {falha !== "inseguro" && falha !== "sem-camera" && (
              <button
                type="button"
                onClick={() => setTentativa((n) => n + 1)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </button>
            )}
            {botaoDeFoto}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 min-h-11 px-4 text-sm font-medium text-white/70 underline underline-offset-4 hover:text-white"
          >
            Voltar ao cardápio
          </button>
        </div>
      )}

      <style>{`
        @keyframes qr-scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(calc(var(--moldura) - 4px)); opacity: 0; }
        }
        .qr-scanline {
          background: linear-gradient(90deg, transparent, #22C55E, transparent);
          box-shadow: 0 0 12px #22C55E, 0 0 24px rgba(34,197,94,0.6);
          animation: qr-scan 2.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .qr-scanline { animation: none; top: 50%; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
