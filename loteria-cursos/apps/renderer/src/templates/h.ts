/** Mini "JSX" para o Satori: h("div", estilo, ...filhos). */
export type Child = SatoriNode | string | number | null | undefined | false;
export interface SatoriNode {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown };
}

export function h(type: string, style: Record<string, unknown>, ...children: Child[]): SatoriNode {
  const kids = children.filter((c) => c !== null && c !== undefined && c !== false) as Array<
    SatoriNode | string | number
  >;
  return {
    type,
    props: { style: { display: "flex", ...style }, children: kids.length === 1 ? kids[0] : kids },
  };
}

export function text(style: Record<string, unknown>, value: string | number): SatoriNode {
  return { type: "div", props: { style: { display: "flex", ...style }, children: String(value) } };
}
