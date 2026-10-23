import { lazy, Suspense, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";

/**
 * A tela da câmera, baixada só quando o cliente toca em "Escanear QR".
 *
 * O leitor de QR pesa uns 370 KB. Antes ele vinha junto com TODO cardápio,
 * inclusive para quem pede delivery e nunca vai escanear mesa nenhuma — era
 * entregar o kit de talheres de mesa junto com cada pedido de entrega. Agora
 * ele chega na hora do toque, em menos de um segundo numa conexão comum.
 */
const QrScanner = lazy(() => import("./QrScanner").then((m) => ({ default: m.QrScanner })));

export function QrScannerSobDemanda(props: ComponentProps<typeof QrScanner>) {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden="true" />
          <p className="text-sm text-white/80" role="status">
            Abrindo a câmera…
          </p>
        </div>
      }
    >
      <QrScanner {...props} />
    </Suspense>
  );
}
