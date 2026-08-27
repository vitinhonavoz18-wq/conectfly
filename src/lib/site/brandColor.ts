/**
 * A cor da marca que chega do FlyControl.
 *
 * O site pinta tudo a partir de uma "receita" no formato
 * `matiz saturação% luminosidade%` — por exemplo `38 92% 50%`. Só que nem
 * todo restaurante tem esse texto gravado: a tabela do painel nasce com
 * `#FF7A00` no campo, e gente que digitou a cor à mão gravou `#101010`.
 *
 * Quando isso acontece, o navegador recebe uma instrução que não entende e
 * simplesmente ignora a cor — como uma comanda escrita em outro idioma, que
 * a cozinha deixa de lado. O prato sai, mas sem o que foi pedido.
 *
 * Este arquivo traduz qualquer um desses formatos para a receita certa.
 */

export type Receita = string;

/**
 * O valor que a tabela `pizzerias` do FlyControl coloca sozinha quando uma
 * loja é criada. Ninguém escolheu essa cor, e ela nunca chegou a aparecer no
 * site — então não conta como decisão do lojista.
 */
const COR_DE_FABRICA = "#FF7A00";

function limitar(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function arredondar(v: number) {
  return Math.round(v * 100) / 100;
}

function hexParaReceita(texto: string): Receita | null {
  let hex = texto.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (hex.length !== 6) return null;

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const maior = Math.max(r, g, b);
  const menor = Math.min(r, g, b);
  const delta = maior - menor;

  let h = 0;
  if (delta !== 0) {
    if (maior === r) h = ((g - b) / delta) % 6;
    else if (maior === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (maior + menor) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return `${arredondar(h)} ${arredondar(s * 100)}% ${arredondar(l * 100)}%`;
}

/**
 * Devolve a receita de cor pronta para o CSS, ou `null` quando a loja não
 * escolheu cor nenhuma — e aí quem manda é a cor do modelo visual.
 */
export function receitaDeCor(bruto: unknown): Receita | null {
  if (typeof bruto !== "string") return null;
  const texto = bruto.trim();
  if (!texto) return null;
  if (texto.toUpperCase() === COR_DE_FABRICA) return null;

  // Já está no formato que o site usa: "38 92% 50%".
  if (texto.includes("%")) {
    const numeros = (texto.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (numeros.length < 3 || numeros.some((n) => Number.isNaN(n))) return null;
    const [h, s, l] = numeros;
    return `${arredondar(((h % 360) + 360) % 360)} ${arredondar(limitar(s, 0, 100))}% ${arredondar(
      limitar(l, 0, 100),
    )}%`;
  }

  return hexParaReceita(texto);
}

/**
 * Preto ou branco, o que se lê melhor por cima da cor recebida.
 *
 * Sem isto, quem escolhe amarelo ganha botão amarelo com letra branca —
 * ilegível no celular, no meio da rua, com sol batendo na tela.
 */
export function letraLegivelSobre(receita: Receita): Receita {
  const numeros = (receita.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const h = ((((numeros[0] ?? 0) % 360) + 360) % 360);
  const s = limitar(numeros[1] ?? 0, 0, 100) / 100;
  const l = limitar(numeros[2] ?? 50, 0, 100) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  // Amarelo a 50% de luz é muito mais claro aos olhos do que azul a 50%: a
  // conta pesa cada canal como o olho pesa.
  const canal = (v: number) => {
    const n = v + m;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  const luminancia = 0.2126 * canal(rgb[0]) + 0.7152 * canal(rgb[1]) + 0.0722 * canal(rgb[2]);

  return luminancia > 0.45 ? "0 0% 0%" : "0 0% 100%";
}
