import { createFileRoute } from "@tanstack/react-router";
import { getSubdomain } from "@/lib/utils/hostname";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/debug-host")({
  component: DebugHost,
});

function DebugHost() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const subdomain = getSubdomain();

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono space-y-4">
      <h1 className="text-2xl font-bold border-b border-green-800 pb-2">DEBUG HOST</h1>
      
      <div className="space-y-2">
        <p><span className="text-gray-500">window.location.href:</span> {window.location.href}</p>
        <p><span className="text-gray-500">window.location.hostname:</span> {window.location.hostname}</p>
        <p><span className="text-gray-500">window.location.pathname:</span> {window.location.pathname}</p>
        <p><span className="text-gray-500">document.referrer:</span> {document.referrer || "(vazio)"}</p>
        <p><span className="text-gray-500">Detectou subdomínio?</span> {subdomain ? "SIM" : "NÃO"}</p>
        <p><span className="text-gray-500">Subdomínio detectado:</span> {subdomain || "(null)"}</p>
      </div>

      <div className="mt-8 p-4 border border-green-800 bg-green-950/20 rounded">
        <h2 className="text-lg font-bold mb-2">Análise:</h2>
        <p>
          Se você vê <strong>{window.location.hostname}</strong> acima e não houve redirect, 
          então o roteamento no subdomínio está funcionando.
        </p>
        <p className="mt-2 text-yellow-500 italic">
          Nota: Se você foi redirecionado para cá a partir do domínio principal, 
          isso indica que algo (pode ser a Lovable ou DNS) está normalizando o acesso.
        </p>
      </div>
    </div>
  );
}
