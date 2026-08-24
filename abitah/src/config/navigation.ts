export type NavItem = {
  label: string;
  href: string;
  description?: string;
};

export const mainNav: NavItem[] = [
  { label: "Início", href: "/" },
  { label: "Loja", href: "/loja" },
  { label: "Roupas", href: "/loja?grupo=roupas" },
  { label: "Acessórios", href: "/loja?grupo=acessorios" },
  { label: "Lançamentos", href: "/lancamentos" },
  { label: "Sobre a marca", href: "/sobre" },
  { label: "Contato", href: "/contato" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Links rápidos",
    items: [
      { label: "Início", href: "/" },
      { label: "Loja completa", href: "/loja" },
      { label: "Lançamentos", href: "/lancamentos" },
      { label: "Mais vendidos", href: "/loja?ordenar=mais-vendidos" },
      { label: "Sobre a marca", href: "/sobre" },
    ],
  },
  {
    title: "Categorias",
    items: [
      { label: "Camisetas", href: "/loja?categoria=camisetas" },
      { label: "Regatas", href: "/loja?categoria=regatas" },
      { label: "Shorts", href: "/loja?categoria=shorts" },
      { label: "Calças e leggings", href: "/loja?categoria=calcas-e-leggings" },
      { label: "Moletons", href: "/loja?categoria=moletons" },
      { label: "Bonés", href: "/loja?categoria=bones" },
      { label: "Garrafas e coqueteleiras", href: "/loja?categoria=garrafas-e-coqueteleiras" },
      { label: "Mochilas e acessórios", href: "/loja?categoria=mochilas-e-acessorios" },
    ],
  },
  {
    title: "Atendimento",
    items: [
      { label: "Fale conosco", href: "/contato" },
      { label: "Minha conta", href: "/conta" },
      { label: "Meus pedidos", href: "/conta/pedidos" },
      { label: "Favoritos", href: "/conta/favoritos" },
      { label: "Perguntas frequentes", href: "/contato#faq" },
    ],
  },
  {
    title: "Políticas",
    items: [
      { label: "Política de privacidade", href: "/politicas/privacidade" },
      { label: "Política de troca", href: "/politicas/trocas" },
      { label: "Política de entrega", href: "/politicas/entrega" },
      { label: "Termos de uso", href: "/politicas/termos" },
    ],
  },
];

export const accountNav: NavItem[] = [
  { label: "Perfil", href: "/conta/perfil" },
  { label: "Meus pedidos", href: "/conta/pedidos" },
  { label: "Endereços", href: "/conta/enderecos" },
  { label: "Favoritos", href: "/conta/favoritos" },
];

export const adminNav: NavItem[] = [
  { label: "Visão geral", href: "/admin" },
  { label: "Produtos", href: "/admin/produtos" },
  { label: "Categorias", href: "/admin/categorias" },
  { label: "Pedidos", href: "/admin/pedidos" },
  { label: "Cupons", href: "/admin/cupons" },
  { label: "Banners e vitrines", href: "/admin/banners" },
  { label: "Configurações", href: "/admin/configuracoes" },
];
