import { createApp } from "./app";
import { config } from "./config";
import { initDatabaseWithRetry, pool } from "./db";

async function main() {
  await initDatabaseWithRetry();

  // Bind to 0.0.0.0 so the server is reachable from outside a container.
  const server = createApp().listen(config.port, "0.0.0.0", () => {
    console.log(`ReadSpace API listening on port ${config.port}`);
  });

  // Docker and Kubernetes stop a container with SIGTERM.
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(`Startup failed: ${(err as Error).message}`);
  process.exit(1);
});
