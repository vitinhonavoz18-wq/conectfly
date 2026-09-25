"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-neon-500">Ops</p>
      <h1 className="mt-4 text-3xl font-black uppercase text-white sm:text-4xl">
        Algo deu errado por aqui
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-smoke-300">
        Tivemos um problema ao carregar esta página. Tente novamente — se persistir, fale com a
        nossa equipe.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={reset}>
          Tentar novamente
        </Button>
        <ButtonLink href="/" variant="outline" size="lg">
          Voltar ao início
        </ButtonLink>
      </div>
    </div>
  );
}
