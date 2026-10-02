import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { correlationId, createLogger, type Logger } from "@lc/shared";
import { loadBrandConfig, type BrandConfig } from "./brand.ts";
import { renderImage, loadFonts } from "./render.ts";
import { renderRequestSchema } from "./schema.ts";
import { safeJoin, createStorage, type StorageAdapter } from "./storage.ts";

export interface RendererOptions {
  outputDir?: string;
  storage?: StorageAdapter;
  brand?: BrandConfig;
  logger?: Logger;
}

export function buildRenderer(options: RendererOptions = {}): FastifyInstance {
  const log = options.logger ?? createLogger({ service: "renderer" });
  const outputDir = options.outputDir ?? process.env.RENDER_OUTPUT_DIR ?? "/data/renders";
  const storage = options.storage ?? createStorage();
  const brand = options.brand ?? loadBrandConfig();
  const app = Fastify({ logger: false, bodyLimit: 512 * 1024 });

  app.addHook("onRequest", async (req, reply) => {
    (req as unknown as { cid: string }).cid = correlationId(req.headers["x-correlation-id"]);
    reply.header("x-correlation-id", (req as unknown as { cid: string }).cid);
  });
  app.setErrorHandler((error, req, reply) => {
    const cid = (req as unknown as { cid?: string }).cid;
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        error_code: "INVALID_PAYLOAD",
        issues: error.issues,
        correlation_id: cid,
      });
    }
    log.error("render_failed", { correlation_id: cid, message: (error as Error).message });
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return reply.status(status).send({
      success: false,
      error_code: status === 400 ? "BAD_REQUEST" : "RENDER_FAILED",
      message: (error as Error).message,
      correlation_id: cid,
    });
  });

  app.get("/health", async () => {
    loadFonts();
    return {
      status: "ok",
      service: "renderer",
      storage_driver: storage.driver,
      templates: ["RESULT", "PREDICTION", "CHECK", "EDUCATIONAL"],
    };
  });

  app.get("/health/storage", async (_req, reply) => {
    const h = await storage.health();
    return reply.status(h.status === "ok" ? 200 : 503).send({ ...h, driver: storage.driver });
  });

  app.post("/render", async (req) => {
    const started = Date.now();
    const input = renderRequestSchema.parse(req.body);
    const image = await renderImage(input, brand);
    const ext = input.output_format === "png" ? "png" : "jpg";
    const rel = input.storage_path
      ? input.storage_path.replace(/\.(jpg|png)$/, `.${ext}`)
      : `${input.game}/adhoc/${input.game}-${input.template.toLowerCase()}-${input.contest}-${input.format}.${ext}`;
    const file = safeJoin(outputDir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, image.buffer);
    let public_url: string | null = null;
    if (input.store)
      public_url = (await storage.upload(rel, image.buffer, image.mime_type)).public_url;
    log.info("render", {
      correlation_id: (req as unknown as { cid: string }).cid,
      template: input.template,
      game: input.game,
      contest: input.contest,
      format: input.format,
      status: "success",
      stored: input.store,
      bytes: image.buffer.length,
      duration_ms: Date.now() - started,
    });
    return {
      success: true,
      template: input.template,
      format: input.format,
      width: image.width,
      height: image.height,
      mime_type: image.mime_type,
      bytes: image.buffer.length,
      file,
      file_name: rel.split("/").pop(),
      storage_path: rel,
      storage_driver: input.store ? storage.driver : null,
      public_url,
      sha256: image.sha256,
    };
  });

  // Serve arquivos gerados (driver local / conferência visual em desenvolvimento).
  app.get("/files/*", async (req, reply) => {
    const rel = (req.params as { "*": string })["*"];
    if (!/^[a-z0-9_]+\/[a-z_]+\/[a-z0-9_-]+\.(jpg|png)$/.test(rel))
      return reply.status(404).send({ error: "not found" });
    try {
      const data = await readFile(safeJoin(outputDir, rel));
      return reply.type(extname(rel) === ".png" ? "image/png" : "image/jpeg").send(data);
    } catch {
      return reply.status(404).send({ error: "not found" });
    }
  });

  return app;
}
