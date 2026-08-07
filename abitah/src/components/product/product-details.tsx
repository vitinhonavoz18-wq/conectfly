import { Accordion } from "@/components/ui/accordion";
import { siteConfig } from "@/config/site";
import type { Product } from "@/types/catalog";

export function ProductDetails({ product }: { product: Product }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <h2 className="section-rule text-xl font-extrabold uppercase text-white">
          Descrição completa
        </h2>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-smoke-300">
          {product.description.split("\n").map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {product.sizeGuide.length ? (
          <div id="tabela-de-medidas" className="mt-10 scroll-mt-28">
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">
              Tabela de medidas
            </h3>
            <div className="mt-4 overflow-x-auto rounded-card border border-ink-700">
              <table className="w-full min-w-100 text-left text-sm">
                <caption className="sr-only">
                  Medidas aproximadas por tamanho de {product.name}
                </caption>
                <thead className="bg-ink-850 text-[11px] uppercase tracking-wider text-smoke-300">
                  <tr>
                    <th scope="col" className="px-4 py-3">Tamanho</th>
                    <th scope="col" className="px-4 py-3">Tórax</th>
                    <th scope="col" className="px-4 py-3">Cintura</th>
                    <th scope="col" className="px-4 py-3">Comprimento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700 text-smoke-300">
                  {product.sizeGuide.map((row) => (
                    <tr key={row.size}>
                      <th scope="row" className="px-4 py-3 font-bold text-white">
                        {row.size}
                      </th>
                      <td className="px-4 py-3">{row.chest}</td>
                      <td className="px-4 py-3">{row.waist}</td>
                      <td className="px-4 py-3">{row.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-smoke-400">
              Medidas aproximadas, com variação de até 2 cm. Em dúvida entre dois tamanhos, fale com
              a gente pelo WhatsApp.
            </p>
          </div>
        ) : null}
      </div>

      <Accordion
        className="h-fit"
        items={[
          {
            question: "Material e composição",
            answer: (
              <div className="space-y-2">
                <p>{product.material}</p>
                <p className="text-smoke-400">
                  Peso aproximado: {product.dimensions.weightGrams} g · Dimensões da embalagem:{" "}
                  {product.dimensions.lengthCm} × {product.dimensions.widthCm} ×{" "}
                  {product.dimensions.heightCm} cm
                </p>
              </div>
            ),
          },
          {
            question: "Cuidados com a peça",
            answer: (
              <ul className="list-disc space-y-1.5 pl-4">
                {product.care.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          },
          {
            question: "Entrega e prazos",
            answer: (
              <div className="space-y-2">
                <p>{siteConfig.policies.dispatchTime}. Enviamos para todo o Brasil com rastreio.</p>
                <p>
                  {siteConfig.commerce.shipping.standard.label}:{" "}
                  {siteConfig.commerce.shipping.standard.eta}. {siteConfig.commerce.shipping.express.label}:{" "}
                  {siteConfig.commerce.shipping.express.eta}.
                </p>
                <p>
                  Retirada na academia disponível em {siteConfig.contact.address.city}/
                  {siteConfig.contact.address.state}, sem custo.
                </p>
              </div>
            ),
          },
          {
            question: "Trocas e devoluções",
            answer: (
              <div className="space-y-2">
                <p>
                  Você tem {siteConfig.policies.exchangeDays} dias para solicitar a troca por
                  tamanho ou cor, e {siteConfig.policies.returnDays} dias para devolução por
                  arrependimento.
                </p>
                <p>
                  A peça precisa estar sem uso, com etiqueta e embalagem originais. A primeira troca
                  por tamanho é por nossa conta.
                </p>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
