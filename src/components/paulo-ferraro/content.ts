/**
 * PAULO FERRARO — ADVOGADO
 * Conteúdo do site (FASE 1/3).
 *
 * ESTE É O ARQUIVO QUE VOCÊ EDITA PARA MUDAR OS TEXTOS DO SITE.
 * Nenhum texto fica "escondido" dentro dos componentes: tudo vem daqui.
 *
 * Onde ainda falta uma informação (telefone, e-mail, OAB, endereço...), o
 * valor está marcado como PENDENTE. O site continua funcionando, mas mostra
 * uma etiqueta dourada tracejada na tela dizendo "a preencher" — impossível
 * de confundir com informação real e impossível de esquecer no ar.
 *
 * Regras de conteúdo respeitadas aqui (publicidade na advocacia):
 * não há promessa de resultado, número inventado, depoimento, comparação
 * com outros profissionais nem captação agressiva de clientela.
 */

/** Marca um dado que o advogado ainda não forneceu. */
export const PENDENTE = "__PENDENTE__" as const;

export type Pendente = typeof PENDENTE;
export type CampoTexto = string | Pendente;

export function isPendente(valor: CampoTexto | undefined | null): boolean {
  return valor === PENDENTE || valor === undefined || valor === null || valor === "";
}

/* -------------------------------------------------------------------------- */
/* IDENTIDADE                                                                  */
/* -------------------------------------------------------------------------- */

export const perfil = {
  nome: "Paulo Ferraro",
  nomeCurto: "Ferraro",
  titulo: "Advogado",
  especialidade: "Direito Médico",
  anosAtuacao: 7,
  /** Aparece no rodapé e no cabeçalho de identidade profissional. */
  oab: PENDENTE as CampoTexto,
  instagram: "@ferrarooadv",
  instagramUrl: "https://instagram.com/ferrarooadv",
} as const;

/* -------------------------------------------------------------------------- */
/* NAVEGAÇÃO                                                                   */
/* -------------------------------------------------------------------------- */

export interface ItemNav {
  rotulo: string;
  ancora: string;
  /**
   * Versão curta, usada só na barra de cima do computador. O menu do celular
   * e o rodapé continuam com o nome por extenso, porque lá sobra espaço.
   */
  curto?: string;
}

export const navegacao: ItemNav[] = [
  { rotulo: "Início", ancora: "inicio" },
  { rotulo: "Sobre", ancora: "sobre" },
  { rotulo: "Direito Médico", ancora: "direito-medico" },
  { rotulo: "Áreas de atuação", ancora: "areas", curto: "Áreas" },
  { rotulo: "Experiência", ancora: "experiencia" },
  { rotulo: "Contato", ancora: "contato" },
];

export const ctaPrincipal = {
  rotulo: "Fale com Paulo Ferraro",
  /** Em telas médias o botão do cabeçalho usa esta versão. */
  rotuloCurto: "Contato",
  ancora: "contato",
};
export const ctaSecundario = { rotulo: "Conhecer áreas de atuação", ancora: "areas" };

/* -------------------------------------------------------------------------- */
/* HERO                                                                        */
/* -------------------------------------------------------------------------- */

export const hero = {
  identificacao: "Paulo Ferraro · Advogado",
  nome: "Paulo Ferraro",
  headline: "Advocacia especializada e atuação jurídica estratégica.",
  destaque: "Direito Médico",
  descricao:
    "Atuação técnica em responsabilidade civil médica. Cada caso é analisado a partir da " +
    "documentação, e o cliente acompanha cada etapa em linguagem que entende.",
  /**
   * Texto alternativo da fotografia (lido por leitores de tela e exibido se a
   * imagem não carregar).
   */
  fotoAlt: "Paulo Ferraro, advogado, de terno cinza e gravata bordô, braços cruzados",
} as const;

/* -------------------------------------------------------------------------- */
/* FAIXA DE AUTORIDADE                                                         */
/* -------------------------------------------------------------------------- */

export interface CredencialItem {
  valor: string;
  rotulo: string;
}

export const credenciais: CredencialItem[] = [
  { valor: "7 anos", rotulo: "de atuação com ética, técnica e responsabilidade" },
  { valor: "Direito Médico", rotulo: "área de maior destaque na atuação" },
  { valor: "6 áreas", rotulo: "do direito atendidas no escritório" },
  { valor: "Atuação institucional", rotulo: "JARI · SEMOB · Prefeitura de Salvador" },
];

/* -------------------------------------------------------------------------- */
/* SOBRE                                                                       */
/* -------------------------------------------------------------------------- */

export const sobre = {
  eyebrow: "Sobre",
  titulo: "Sete anos de prática jurídica orientada por ética, técnica e responsabilidade.",
  paragrafos: [
    "Paulo Ferraro acompanha pessoas em momentos delicados: quando um tratamento de saúde " +
      "não segue o curso esperado, quando um direito é negado ou quando uma decisão " +
      "administrativa precisa ser revista.",
    "Sua área de maior destaque é o Direito Médico. Cada caso é examinado a partir da " +
      "documentação, do histórico clínico e do que a legislação e a jurisprudência " +
      "efetivamente permitem sustentar.",
    "O cliente entende o que está sendo discutido, quais caminhos existem e em que etapa o " +
      "processo se encontra — sem promessas e sem termos que ele não compreenda.",
  ],
  /** Número em destaque ao lado da fotografia. */
  destaque: { valor: "07", unidade: "anos", rotulo: "de atuação profissional" },
  /** Os três princípios que a própria apresentação do advogado enuncia. */
  pilares: [
    {
      titulo: "Ética",
      descricao: "Conduta orientada pelo Código de Ética e Disciplina da advocacia.",
    },
    {
      titulo: "Técnica",
      descricao: "Análise fundamentada em documentação, legislação e jurisprudência.",
    },
    {
      titulo: "Responsabilidade",
      descricao: "Clareza sobre os caminhos possíveis e sobre os limites de cada um.",
    },
  ],
  /** Texto alternativo da segunda fotografia (seção Sobre). */
  fotoAlt: "Retrato profissional do advogado Paulo Ferraro",
  assinatura: "Paulo Ferraro · Advogado",
} as const;

/* -------------------------------------------------------------------------- */
/* DIREITO MÉDICO — seção principal                                            */
/* -------------------------------------------------------------------------- */

export interface TemaJuridico {
  numero: string;
  titulo: string;
  descricao: string;
}

export const direitoMedico = {
  eyebrow: "Área de maior destaque",
  titulo: "Direito Médico",
  chamada:
    "Responsabilidade civil médica analisada com critério técnico, documentação e " +
    "acompanhamento próximo de quem passou pela situação.",
  introducao:
    "Nem todo resultado indesejado configura erro, e nem todo erro é juridicamente " +
    "indenizável. O primeiro passo é entender o que aconteceu, reunir a documentação e " +
    "avaliar se existe fundamento técnico para uma ação.",
  temas: [
    {
      numero: "01",
      titulo: "Erro Médico",
      descricao:
        "Análise de condutas médicas e hospitalares que possam ter se afastado do dever " +
        "de cuidado esperado, considerando prontuário, exames e histórico do atendimento.",
    },
    {
      numero: "02",
      titulo: "Erro de Diagnóstico",
      descricao:
        "Situações de diagnóstico equivocado, tardio ou não realizado, e os reflexos " +
        "dessa falha sobre o tratamento recebido e sobre a saúde do paciente.",
    },
    {
      numero: "03",
      titulo: "Dano Estético",
      descricao:
        "Casos em que um procedimento resulta em alteração estética não pretendida, " +
        "avaliando o que foi contratado, o que foi informado e o que efetivamente ocorreu.",
    },
    {
      numero: "04",
      titulo: "Responsabilidade Civil Médica",
      descricao:
        "Apuração da responsabilidade de profissionais, clínicas, hospitais e planos de " +
        "saúde, conforme o vínculo existente e a natureza da obrigação assumida.",
    },
    {
      numero: "05",
      titulo: "Ações Indenizatórias",
      descricao:
        "Condução de ações que buscam a reparação de danos materiais, morais e estéticos " +
        "decorrentes da responsabilidade civil médica, com fundamentação técnica.",
    },
  ] satisfies TemaJuridico[],
  nota:
    "A análise de viabilidade é feita caso a caso. Não há como antecipar resultado de " +
    "processo judicial, e este site não faz esse tipo de promessa.",
};

/* -------------------------------------------------------------------------- */
/* OUTRAS ÁREAS DE ATUAÇÃO                                                     */
/* -------------------------------------------------------------------------- */

/** Chave do ícone: mapeada para o desenho correspondente em PFPracticeAreas. */
export type IconeArea = "previdenciario" | "consumidor" | "civel" | "familia" | "transito";

export interface AreaAtuacao {
  icone: IconeArea;
  titulo: string;
  descricao: string;
  topicos: string[];
}

export const areas = {
  eyebrow: "Áreas de atuação",
  titulo: "Outras frentes atendidas pelo escritório",
  chamada:
    "Além do Direito Médico, o escritório atende demandas recorrentes da vida civil, " +
    "previdenciária e administrativa.",
  lista: [
    {
      icone: "previdenciario",
      titulo: "Direito Previdenciário",
      descricao:
        "Orientação e atuação em pedidos e revisões junto à Previdência Social, com " +
        "análise da documentação e do histórico contributivo.",
      topicos: ["Benefícios", "Revisões", "Planejamento previdenciário"],
    },
    {
      icone: "consumidor",
      titulo: "Direito do Consumidor",
      descricao:
        "Conflitos em relações de consumo, cobranças indevidas, falhas na prestação de " +
        "serviço e descumprimento do que foi contratado.",
      topicos: ["Cobrança indevida", "Vício do produto", "Falha de serviço"],
    },
    {
      icone: "civel",
      titulo: "Direito Cível",
      descricao:
        "Demandas patrimoniais e obrigacionais, responsabilidade civil, contratos e " +
        "reparação de danos entre particulares e empresas.",
      topicos: ["Contratos", "Responsabilidade civil", "Reparação de danos"],
    },
    {
      icone: "familia",
      titulo: "Direito de Família",
      descricao:
        "Questões familiares conduzidas com discrição e cuidado, priorizando soluções " +
        "que preservem as relações envolvidas sempre que possível.",
      topicos: ["Divórcio", "Guarda", "Alimentos", "Partilha"],
    },
    {
      icone: "transito",
      titulo: "Direito de Trânsito",
      descricao:
        "Defesa administrativa em autos de infração, processos de suspensão e cassação " +
        "do direito de dirigir e recursos junto aos órgãos competentes.",
      topicos: ["Defesa prévia", "Recursos administrativos", "Suspensão da CNH"],
    },
  ] satisfies AreaAtuacao[],
};

/* -------------------------------------------------------------------------- */
/* TRAJETÓRIA / EXPERIÊNCIA INSTITUCIONAL                                      */
/* -------------------------------------------------------------------------- */

export interface MarcoTrajetoria {
  rotulo: string;
  titulo: string;
  descricao: string;
}

export const experiencia = {
  eyebrow: "Trajetória",
  titulo: "Experiência institucional",
  chamada:
    "A atuação de Paulo Ferraro também alcança o âmbito administrativo público, na " +
    "análise de recursos em matéria de trânsito e mobilidade urbana.",
  marcos: [
    {
      rotulo: "Atuação institucional",
      titulo: "Coordenador / Presidente de JARI",
      descricao:
        "Junta Administrativa de Recursos de Infrações — colegiado responsável pelo " +
        "julgamento de recursos apresentados contra autuações de trânsito.",
    },
    {
      rotulo: "Órgão",
      titulo: "SEMOB — Secretaria Municipal de Mobilidade",
      descricao:
        "Prefeitura Municipal de Salvador. Atuação em matéria de trânsito e mobilidade " +
        "urbana no âmbito administrativo.",
    },
    {
      rotulo: "Prática privada",
      titulo: "7 anos de advocacia",
      descricao:
        "Atuação com ética, técnica e responsabilidade, com destaque para o Direito " +
        "Médico e para a responsabilidade civil médica.",
    },
  ] satisfies MarcoTrajetoria[],
};

/* -------------------------------------------------------------------------- */
/* COMO FUNCIONA O ATENDIMENTO                                                 */
/* -------------------------------------------------------------------------- */

export interface EtapaAtendimento {
  numero: string;
  titulo: string;
  descricao: string;
}

export const atendimento = {
  eyebrow: "Como funciona",
  titulo: "Do primeiro contato à orientação",
  chamada:
    "Três etapas, sem compromisso de contratação. O objetivo do primeiro contato é " +
    "entender a situação e indicar os próximos passos.",
  etapas: [
    {
      numero: "01",
      titulo: "Contato",
      descricao:
        "Você descreve a situação pelo canal que preferir. Nesse momento não é necessário " +
        "ter toda a documentação em mãos.",
    },
    {
      numero: "02",
      titulo: "Análise inicial",
      descricao:
        "O caso é examinado a partir dos fatos relatados e dos documentos disponíveis, " +
        "para identificar quais questões jurídicas estão envolvidas.",
    },
    {
      numero: "03",
      titulo: "Orientação sobre os próximos passos",
      descricao:
        "Você recebe uma explicação clara sobre os caminhos possíveis, o que cada um " +
        "envolve e o que seria necessário para seguir adiante.",
    },
  ] satisfies EtapaAtendimento[],
  nota: "Este contato não constitui contratação de serviços nem garantia de resultado.",
};

/* -------------------------------------------------------------------------- */
/* CTA INSTITUCIONAL                                                           */
/* -------------------------------------------------------------------------- */

export const ctaInstitucional = {
  eyebrow: "Atendimento",
  titulo: "Sua situação merece uma análise técnica antes de qualquer decisão.",
  descricao:
    "Se você tem dúvidas sobre um atendimento médico, sobre um direito negado ou sobre " +
    "uma autuação recebida, converse com o advogado e entenda o que pode ser feito.",
} as const;

/* -------------------------------------------------------------------------- */
/* CONTATO                                                                     */
/* -------------------------------------------------------------------------- */

export interface CanalContato {
  chave: "whatsapp" | "telefone" | "email" | "localizacao" | "instagram";
  rotulo: string;
  valor: CampoTexto;
  /** Endereço do link (tel:, mailto:, https://...). PENDENTE deixa o item inativo. */
  href: CampoTexto;
  descricao: string;
}

export const contato = {
  eyebrow: "Contato",
  titulo: "Falar com o advogado",
  chamada:
    "Escolha o canal de sua preferência. O retorno é feito pessoalmente pelo advogado, " +
    "dentro do horário de atendimento.",
  /** Frase curta acima dos canais, para leitura de relance no celular. */
  resumo: "Descreva a situação. A partir daí, o caminho jurídico é explicado com clareza.",
  canais: [
    {
      chave: "whatsapp",
      rotulo: "WhatsApp",
      valor: PENDENTE,
      href: PENDENTE,
      descricao: "Canal mais direto para um primeiro contato.",
    },
    {
      chave: "telefone",
      rotulo: "Telefone",
      valor: PENDENTE,
      href: PENDENTE,
      descricao: "Atendimento telefônico em horário comercial.",
    },
    {
      chave: "email",
      rotulo: "E-mail",
      valor: PENDENTE,
      href: PENDENTE,
      descricao: "Indicado para o envio de documentos e relatos mais longos.",
    },
    {
      chave: "localizacao",
      rotulo: "Localização",
      valor: PENDENTE,
      href: PENDENTE,
      descricao: "Atendimento presencial mediante agendamento prévio.",
    },
    {
      chave: "instagram",
      rotulo: "Instagram",
      valor: perfil.instagram,
      href: perfil.instagramUrl,
      descricao: "Conteúdo e atualizações profissionais.",
    },
  ] satisfies CanalContato[],
  horario: PENDENTE as CampoTexto,
  nota:
    "As informações desta página têm caráter informativo e não substituem a análise " +
    "individualizada de cada caso.",
};

/* -------------------------------------------------------------------------- */
/* RODAPÉ                                                                      */
/* -------------------------------------------------------------------------- */

export interface LinkLegal {
  rotulo: string;
  href: CampoTexto;
}

export const rodape = {
  descricao:
    "Advocacia com atuação em Direito Médico, Previdenciário, do Consumidor, Cível, de " +
    "Família e de Trânsito.",
  linksLegais: [
    { rotulo: "Política de Privacidade", href: PENDENTE },
    { rotulo: "Termos de Uso", href: PENDENTE },
  ] satisfies LinkLegal[],
  avisoEtico:
    "Site de caráter meramente informativo, em conformidade com o Código de Ética e " +
    "Disciplina da OAB e com o Provimento nº 205/2021 do Conselho Federal da OAB. " +
    "Não constitui oferta de serviços, captação de clientela nem promessa de resultado.",
  copyright: `© ${new Date().getFullYear()} ${perfil.nome}. Todos os direitos reservados.`,
};

/* -------------------------------------------------------------------------- */
/* SEO                                                                         */
/* -------------------------------------------------------------------------- */

export const seo = {
  titulo: "Paulo Ferraro | Advogado — Direito Médico",
  descricao:
    "Paulo Ferraro, advogado com 7 anos de atuação e destaque em Direito Médico: erro " +
    "médico, erro de diagnóstico, dano estético e responsabilidade civil médica. Também " +
    "atende Direito Previdenciário, do Consumidor, Cível, de Família e de Trânsito.",
} as const;
