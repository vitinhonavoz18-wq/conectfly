import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { findPolicy, policies } from "@/data/policies";
import { formatDate } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return policies.map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const policy = findPolicy(slug);
  if (!policy) return { title: "Política não encontrada" };

  return {
    title: policy.title,
    description: policy.summary,
    alternates: { canonical: `/politicas/${policy.slug}` },
  };
}

export default async function PolicyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const policy = findPolicy(slug);
  if (!policy) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Documentos"
        title={policy.title}
        description={policy.summary}
        breadcrumbs={[{ label: policy.title }]}
      />

      <article className="container-page py-10 lg:py-14">
        <p className="mb-8 text-xs text-smoke-400">
          Última atualização: {formatDate(policy.updatedAt)}
        </p>

        <div className="max-w-3xl space-y-9">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-bold uppercase tracking-wide text-white">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-smoke-300">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </>
  );
}
