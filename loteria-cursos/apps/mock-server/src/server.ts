import { buildMockServer } from "./app.ts";

const port = Number(process.env.PORT ?? 4010);
const app = buildMockServer({ fixturesDir: process.env.FIXTURES_DIR ?? "/fixtures" });
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => console.log(JSON.stringify({ event: "mock_server_started", port })))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => app.close().finally(() => process.exit(0)));
