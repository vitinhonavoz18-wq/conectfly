/**
 * Campo de envio de arquivo (foto, selfie, documento).
 *
 * Mostra o que já foi enviado, deixa trocar e avisa enquanto envia. O
 * arquivo vai direto para o armazenamento seguro — este componente só
 * conduz.
 */

import { useRef, useState } from "react";
import { Camera, FileCheck2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { zcErrorMessage, zcUploadFile, type ZcBucketName } from "@/lib/zecarreto/client";

interface ZcUploadProps {
  label: string;
  hint?: string;
  bucket: ZcBucketName;
  purpose: string;
  accept?: string;
  currentUrl?: string | null;
  done?: boolean;
  onUploaded: (result: { path: string; publicUrl?: string }) => void | Promise<void>;
}

export function ZcUpload({
  label,
  hint,
  bucket,
  purpose,
  accept = "image/jpeg,image/png,image/webp,image/heic,application/pdf",
  currentUrl,
  done,
  onUploaded,
}: ZcUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const result = await zcUploadFile(file, { bucket, purpose });
      await onUploaded(result);
      toast.success(`${label}: enviado.`);
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
        {done ? (
          <FileCheck2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <Camera className="h-5 w-5 text-neutral-500" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-neutral-500">
          {done ? "Enviado" : (hint ?? "Nenhum arquivo enviado")}
        </p>
      </div>
      {currentUrl && (
        <a
          href={currentUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-neutral-500 underline"
        >
          ver
        </a>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Upload className="mr-1 h-4 w-4" />
            {done ? "Trocar" : "Enviar"}
          </>
        )}
      </Button>
    </div>
  );
}
