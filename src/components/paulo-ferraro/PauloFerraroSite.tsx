import { PFFooter } from "./layout/PFFooter";
import { PFHeader } from "./layout/PFHeader";
import { PFAbout } from "./sections/PFAbout";
import { PFAuthorityStrip } from "./sections/PFAuthorityStrip";
import { PFContact } from "./sections/PFContact";
import { PFCta } from "./sections/PFCta";
import { PFExperience } from "./sections/PFExperience";
import { PFHero } from "./sections/PFHero";
import { PFMedicalLaw } from "./sections/PFMedicalLaw";
import { PFPracticeAreas } from "./sections/PFPracticeAreas";
import { PFProcess } from "./sections/PFProcess";

/**
 * Página do advogado Paulo Ferraro — montagem das seções.
 *
 * Este arquivo é só a ordem do site. Cada seção mora em seu próprio arquivo,
 * então mexer no "Direito Médico" não corre o risco de estragar o "Contato".
 *
 * A classe `pf-root` é a fronteira do projeto: todas as cores e fontes do
 * advogado valem apenas dentro dela. O painel do SiteCreatorFly, que divide o
 * mesmo sistema, continua exatamente como está — como dois apartamentos no
 * mesmo prédio, com instalações separadas.
 *
 * O ritmo de fundo alterna de propósito (preto → grafite → off-white → preto),
 * do mesmo jeito que uma revista alterna páginas escuras e claras para a
 * leitura não cansar.
 */
export function PauloFerraroSite() {
  return (
    // `lang` marca a página como português do Brasil: é o que faz o leitor de
    // tela pronunciar "responsabilidade" em vez de tentar ler em inglês. Fica
    // aqui, e não na base do sistema, para não alterar o painel do
    // SiteCreatorFly.
    <div className="pf-root" lang="pt-BR">
      <a href="#conteudo" className="pf-skip-link">
        Ir para o conteúdo
      </a>

      <PFHeader />

      <main id="conteudo">
        <PFHero />
        <PFAuthorityStrip />
        <PFAbout />
        <PFMedicalLaw />
        <PFPracticeAreas />
        <PFExperience />
        <PFProcess />
        <PFCta />
        <PFContact />
      </main>

      <PFFooter />
    </div>
  );
}
