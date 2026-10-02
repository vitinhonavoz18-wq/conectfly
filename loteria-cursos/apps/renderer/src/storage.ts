import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { fetchWithTimeout } from "@lc/shared";

/**
 * Onde a arte fica guardada. Em produção: Supabase Storage (bucket público
 * "social-media"), porque a Meta precisa BAIXAR a imagem por uma URL pública.
 * Em desenvolvimento: pasta local servida pelo próprio renderer em /files/.
 */
export interface StorageAdapter {
  readonly driver: string;
  upload(path: string, data: Buffer, contentType: string): Promise<{ public_url: string }>;
  health(): Promise<{ status: "ok" | "down"; detail?: string }>;
}

export function safeJoin(root: string, rel: string): string {
  const target = normalize(join(root, rel));
  if (!target.startsWith(normalize(root) + sep)) throw new Error("caminho fora da pasta permitida");
  return target;
}

export class LocalStorage implements StorageAdapter {
  readonly driver = "local";
  constructor(
    private readonly root: string,
    private readonly publicBaseUrl: string,
  ) {}
  async upload(path: string, data: Buffer) {
    const target = safeJoin(this.root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    return { public_url: `${this.publicBaseUrl.replace(/\/+$/, "")}/files/${path}` };
  }
  async health() {
    try {
      await mkdir(this.root, { recursive: true });
      await stat(this.root);
      return { status: "ok" as const };
    } catch (error) {
      return { status: "down" as const, detail: (error as Error).message };
    }
  }
}

/** Supabase Storage via REST (sem SDK). A chave fica só no servidor (nunca no front). */
export class SupabaseStorage implements StorageAdapter {
  readonly driver = "supabase";
  constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly bucket: string,
    private readonly timeoutMs = 30_000,
  ) {
    if (!url || !key || !bucket)
      throw new Error(
        "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_STORAGE_BUCKET são obrigatórios",
      );
  }
  private headers(): Record<string, string> {
    // Chaves novas (sb_secret_…) vão só no header apikey; chaves legadas (JWT) também no Authorization.
    const h: Record<string, string> = { apikey: this.key };
    if (this.key.startsWith("eyJ")) h.Authorization = `Bearer ${this.key}`;
    return h;
  }
  private base() {
    return this.url.replace(/\/+$/, "");
  }
  async upload(path: string, data: Buffer, contentType: string) {
    const res = await fetchWithTimeout(
      `${this.base()}/storage/v1/object/${encodeURIComponent(this.bucket)}/${path}`,
      {
        method: "POST",
        timeoutMs: this.timeoutMs,
        headers: {
          ...this.headers(),
          "Content-Type": contentType,
          "x-upsert": "true",
          "Cache-Control": "max-age=3600",
        },
        body: new Uint8Array(data),
      },
    );
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      throw new Error(`upload no Supabase Storage falhou: HTTP ${res.status} ${text}`);
    }
    return {
      public_url: `${this.base()}/storage/v1/object/public/${encodeURIComponent(this.bucket)}/${path}`,
    };
  }
  async health() {
    try {
      const res = await fetchWithTimeout(
        `${this.base()}/storage/v1/bucket/${encodeURIComponent(this.bucket)}`,
        { timeoutMs: 8000, headers: this.headers() },
      );
      if (!res.ok) return { status: "down" as const, detail: `HTTP ${res.status}` };
      const body = (await res.json().catch(() => ({}))) as { public?: boolean };
      return body.public === false
        ? {
            status: "down" as const,
            detail: "bucket não é público: a Meta não conseguirá baixar a imagem",
          }
        : { status: "ok" as const };
    } catch (error) {
      return { status: "down" as const, detail: (error as Error).message };
    }
  }
}

export function createStorage(env = process.env): StorageAdapter {
  const driver = env.STORAGE_DRIVER ?? "local";
  if (driver === "supabase") {
    return new SupabaseStorage(
      env.SUPABASE_URL ?? "",
      env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      env.SUPABASE_STORAGE_BUCKET ?? "social-media",
    );
  }
  if (driver === "local") {
    return new LocalStorage(
      env.RENDER_OUTPUT_DIR ?? "/data/renders",
      env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT ?? 3000}`,
    );
  }
  throw new Error(`STORAGE_DRIVER desconhecido: ${driver}`);
}
