/** Limite simples por chave (celular ou IP): N pedidos por janela deslizante. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Devolve 0 se pode seguir, ou quantos segundos esperar. */
  check(key: string): number {
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return Math.ceil((this.windowMs - (t - list[0])) / 1000);
    }
    list.push(t);
    this.hits.set(key, list);
    return 0;
  }
}
