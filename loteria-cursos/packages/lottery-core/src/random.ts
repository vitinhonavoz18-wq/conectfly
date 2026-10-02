import { createHash } from "node:crypto";

/**
 * Gerador pseudoaleatório com semente (sfc32). Mesma semente ⇒ mesma sequência,
 * o que torna os palpites reproduzíveis e os testes determinísticos.
 */
export function seededRandom(seed: string): () => number {
  const h = createHash("sha256").update(seed).digest();
  let a = h.readUInt32LE(0);
  let b = h.readUInt32LE(4);
  let c = h.readUInt32LE(8);
  let d = h.readUInt32LE(12);
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
