Revisão final de estabilidade e refinamento do fluxo principal (SiteCreatorFly e FlyControl) para prontidão comercial.

### Exploração Técnica Realizada
*   **Rotas e Auth**: Rota administrativa protegida pelo e-mail `vitinhonavoz18@gmail.com`. Rotas públicas `$slug` redirecionam corretamente.
*   **Checkout**: Processo via WhatsApp e Proxy Seguro para FlyControl. Validações de campos obrigatórios e modo de fluxo.
*   **Bebidas**: Implementação recente de catálogos e bebidas avulsas integrada aos templates.
*   **Templates**: Revisão dos estilos (Black, White, PizzaRed, Burger) e como renderizam componentes.

### Ajustes e Estabilização

#### 1. Interface e Estilo (Mobile e Desktop)
*   **Contraste e Legibilidade**: Garantir que as cores HSL no `SiteThemeWrapper.tsx` tenham contraste adequado, especialmente em botões e textos de preço.
*   **Checkout Compacto**: Refinar o CSS do `SiteCartDrawer.tsx` para garantir que o formulário seja o mais verticalmente denso possível no mobile, evitando scroll excessivo.
*   **Botões e Estados**: Corrigir potenciais botões brancos/invisíveis em estados de hover ou focus nos diversos templates.

#### 2. Fluxo de Pedidos e Dados
*   **Prevenção de Erros de Banco**: Garantir que se tabelas como `pizzeria_pizza_sizes` estiverem vazias, o sistema use o fallback JSONB sem quebrar.
*   **Performance do Carregamento**: Otimizar queries no `queries.ts` para evitar carregamentos infinitos em casos de erro.
*   **Segurança (RLS)**: Validar se as políticas de RLS garantem que donos vejam apenas seus próprios dados (já implementado via Edge Functions seguras, mas revisaremos o linter).

#### 3. Refinamentos Finais
*   **Bebidas**: Garantir que bebidas avulsas não apareçam duplicadas se pertencerem a uma categoria de cardápio comum.
*   **WhatsApp**: Validar se a mensagem gerada no `orderFormatter.ts` está limpa e profissional.

### Critérios de Sucesso
*   Fluxo completo: Criação -> Configuração -> Cardápio Público -> Pedido -> FlyControl.
*   Ausência de erros críticos no console (404, 500).
*   Experiência mobile premium e funcional.
