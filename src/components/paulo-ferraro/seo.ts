import { logoMarca } from "./assets";
import { areas, cidade, contato, direitoMedico, isPendente, perfil, seo } from "./content";

/**
 * Dados estruturados — a "ficha catalográfica" que o site entrega ao Google.
 *
 * O texto da página é escrito para gente. Isto aqui é a mesma informação
 * escrita para máquina: quem é o profissional, o que ele faz, onde atua. É o
 * que permite ao Google mostrar o resultado com destaque em vez de um link
 * seco — como a diferença entre um cardápio escrito à mão e a ficha técnica
 * que o aplicativo de delivery usa para montar a página do restaurante.
 *
 * REGRA QUE VALE MAIS QUE O GANHO DE BUSCA: nada aqui é inventado. Telefone,
 * e-mail, endereço e OAB só entram na ficha depois que forem informados de
 * verdade em `content.ts`. Declarar dado falso para máquina de busca é pior do
 * que não declarar nada — o Google cruza essas informações com outras fontes e
 * penaliza o site quando elas não batem.
 */
export function dadosEstruturados(): string {
  const temDominio = !isPendente(seo.dominio);
  const base = temDominio ? String(seo.dominio).replace(/\/$/, "") : undefined;

  const canal = (chave: string) => contato.canais.find((c) => c.chave === chave);
  const telefone = canal("telefone");
  const email = canal("email");

  const advogado: Record<string, unknown> = {
    "@type": "Person",
    name: perfil.nome,
    jobTitle: perfil.titulo,
    knowsAbout: [
      direitoMedico.titulo,
      ...areas.lista.map((area) => area.titulo),
      "Responsabilidade civil médica",
    ],
    sameAs: [perfil.instagramUrl],
  };

  // Só entra na ficha o que já existe de fato.
  if (!isPendente(perfil.oab)) advogado.identifier = perfil.oab;
  if (telefone && !isPendente(telefone.valor)) advogado.telephone = telefone.valor;
  if (email && !isPendente(email.valor)) advogado.email = email.valor;
  if (base) advogado.url = base;

  const escritorio: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    // O nome que está escrito na logo oficial, e não um nome de fantasia
    // inventado aqui.
    name: `${perfil.nome} — ${perfil.descritor}`,
    alternateName: perfil.nome,
    description: seo.descricao,
    // Apenas "provider": dizer "founder" afirmaria que ele fundou o
    // escritório, e isso não foi informado.
    provider: advogado,
    areaServed: {
      "@type": "City",
      name: cidade.nome,
      addressRegion: cidade.estado,
      addressCountry: cidade.pais,
    },
    knowsLanguage: "pt-BR",
    serviceType: [direitoMedico.titulo, ...areas.lista.map((area) => area.titulo)],
    sameAs: [perfil.instagramUrl],
  };

  if (base) escritorio.url = base;
  if (telefone && !isPendente(telefone.valor)) escritorio.telephone = telefone.valor;
  if (email && !isPendente(email.valor)) escritorio.email = email.valor;

  // A logo é o que o Google usa para desenhar o quadrinho do escritório no
  // resultado de busca. Só entra na ficha quando o domínio já existe: o
  // endereço da imagem precisa ser completo ("https://...") para o buscador
  // conseguir baixá-la — um caminho solto não leva a lugar nenhum.
  if (base && logoMarca) escritorio.logo = `${base}${logoMarca}`;

  return JSON.stringify(escritorio);
}

/** Endereço absoluto de uma página do site, ou `undefined` sem domínio definido. */
export function urlAbsoluta(caminho = "/paulo-ferraro"): string | undefined {
  if (isPendente(seo.dominio)) return undefined;
  return `${String(seo.dominio).replace(/\/$/, "")}${caminho}`;
}
