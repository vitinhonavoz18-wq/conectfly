import { describe, expect, it } from "vitest";

import { RESERVED_SITE_PATHS, getMenuSyncEndpoint, getPizzeriaPublicUrl } from "./format";
import {
  API_ORIGIN,
  MENU_ORIGIN,
  isMenuHost,
  isMenuOrigin,
  isReservedPath,
  menuDomainRedirect,
} from "./publicDomain";

describe("endereço oficial dos cardápios", () => {
  it("loja nova nasce em cardapio.flydelivery.app", () => {
    expect(MENU_ORIGIN).toBe("https://cardapio.flydelivery.app");
    expect(getPizzeriaPublicUrl("pizzaria-do-joao")).toBe(
      "https://cardapio.flydelivery.app/pizzaria-do-joao",
    );
    expect(getPizzeriaPublicUrl("pizzaria-do-joao-3f2a", "joao")).toBe(
      "https://cardapio.flydelivery.app/joao",
    );
  });

  it("a API servidor-com-servidor continua no endereço de sempre", () => {
    expect(API_ORIGIN).toBe("https://conectfly.com.br");
    expect(getMenuSyncEndpoint("joao", "tok")).toBe(
      "https://conectfly.com.br/api/public/menu-sync/joao/tok",
    );
  });

  it("reconhece endereços novos e antigos como cardápio", () => {
    expect(isMenuHost("cardapio.flydelivery.app")).toBe(true);
    expect(isMenuHost("conectfly.com.br")).toBe(true);
    expect(isMenuHost("www.conectfly.com.br")).toBe(true);
    expect(isMenuHost("localhost")).toBe(true);
    expect(isMenuHost("site.conectfly.com.br")).toBe(false);
    expect(isMenuHost("cardapio.flydelivery.app.golpe.com")).toBe(false);
    expect(isMenuOrigin("https://cardapio.flydelivery.app")).toBe(true);
    expect(isMenuOrigin("https://golpe.com")).toBe(false);
    expect(isMenuOrigin(null)).toBe(false);
  });

  it("a lista de nomes reservados é a mesma nos dois arquivos", () => {
    for (const nome of RESERVED_SITE_PATHS) expect(isReservedPath(nome)).toBe(true);
    expect(isReservedPath("pizzaria-do-joao")).toBe(false);
  });
});

describe("redirecionamento do endereço antigo", () => {
  const ligado = true;

  it("leva o cardápio antigo para o novo, com o QR Code da mesa intacto", () => {
    expect(
      menuDomainRedirect(
        "https://conectfly.com.br/pizzaria-do-joao?mode=table&table_number=4&table_token=abc",
        ligado,
      ),
    ).toEqual({
      location:
        "https://cardapio.flydelivery.app/pizzaria-do-joao?mode=table&table_number=4&table_token=abc",
      status: 301,
    });
    expect(menuDomainRedirect("https://www.conectfly.com.br/Joao", ligado)?.location).toBe(
      "https://cardapio.flydelivery.app/Joao",
    );
  });

  it("não mexe na API, no editor, em arquivos nem em páginas reservadas", () => {
    for (const caminho of [
      "/",
      "/login",
      "/edit/123",
      "/export/123",
      "/api/public/submit-order",
      "/api/internal/provision-restaurant",
      "/api/public/menu-sync/joao/tok",
      "/favicon.ico",
      "/robots.txt",
      "/assets/app-123.js",
      "/paulo-ferraro",
      "/debug-host",
      "/checkout",
    ]) {
      expect(menuDomainRedirect(`https://conectfly.com.br${caminho}`, ligado)).toBeNull();
    }
  });

  it("não mexe em outros sites da Connectfly", () => {
    expect(menuDomainRedirect("https://site.conectfly.com.br/joao", ligado)).toBeNull();
    expect(menuDomainRedirect("https://flycontrol.conectfly.com.br/joao", ligado)).toBeNull();
    expect(menuDomainRedirect("https://flydelivery.app/joao", ligado)).toBeNull();
  });

  it("com o interruptor desligado, o endereço antigo abre o cardápio direto", () => {
    expect(menuDomainRedirect("https://conectfly.com.br/pizzaria-do-joao", false)).toBeNull();
  });

  it("no endereço novo, a raiz leva para o site do FlyDelivery e a loja abre normal", () => {
    expect(menuDomainRedirect("https://cardapio.flydelivery.app/", ligado)).toEqual({
      location: "https://flydelivery.app/",
      status: 302,
    });
    expect(menuDomainRedirect("https://cardapio.flydelivery.app/joao?mesa=2", ligado)).toBeNull();
  });
});
