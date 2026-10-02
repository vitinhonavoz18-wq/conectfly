import { createLogger } from "@lc/shared";
import { buildEngine } from "./app.ts";

const log = createLogger({ service: "engine" });
const app = buildEngine({ logger: log });
const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => log.info("engine_started", { port, source: process.env.LOTTERY_SOURCE ?? "caixa" }))
  .catch((error: Error) => {
    log.error("engine_start_failed", { message: error.message });
    process.exit(1);
  });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.close().finally(() => process.exit(0));
  });
}
