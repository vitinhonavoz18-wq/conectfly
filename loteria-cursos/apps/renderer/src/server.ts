import { createLogger } from "@lc/shared";
import { buildRenderer } from "./app.ts";

const log = createLogger({ service: "renderer" });
const app = buildRenderer({ logger: log });
const port = Number(process.env.PORT ?? 3000);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() =>
    log.info("renderer_started", { port, storage_driver: process.env.STORAGE_DRIVER ?? "local" }),
  )
  .catch((error: Error) => {
    log.error("renderer_start_failed", { message: error.message });
    process.exit(1);
  });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.close().finally(() => process.exit(0));
  });
}
