import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-neon-500">Erro 404</p>
      <h1 className="mt-4 text-4xl font-black uppercase text-white sm:text-5xl">
        Página não encontrada
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-smoke-300">
        O endereço que você tentou acessar não existe ou foi movido. Continue navegando pela coleção.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/" size="lg">
          Voltar ao início
        </ButtonLink>
        <ButtonLink href="/loja" variant="outline" size="lg">
          Ir para a loja
        </ButtonLink>
      </div>
    </div>
  );
}
