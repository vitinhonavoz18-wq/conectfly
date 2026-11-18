"use client";

import { useSelectedLayoutSegment } from "next/navigation";

export function ConnectflySignature() {
  const segment = useSelectedLayoutSegment();
  if (!["", "sobre", "contato", "lancamentos", "loja"].includes(segment ?? "")) return null;

  return (
    <span>
      Feito pela{" "}
      <a
        href="https://site.conectfly.com.br"
        className="font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        CONNECTFLY
      </a>
    </span>
  );
}
