import { createRequestHandler } from "./app";
import { loadConfig } from "./config";
import { closeDatabase } from "./db";
import { createPostgresWaitlistStore, WaitlistOutbox } from "./waitlist";

const config = loadConfig();
const waitlistStore = config.databaseUrl ? createPostgresWaitlistStore(config) : null;

if (waitlistStore) await waitlistStore.ready();

const waitlistOutbox = waitlistStore ? new WaitlistOutbox(waitlistStore, config.waitlistForwardUrl) : null;
waitlistOutbox?.start();

const route = createRequestHandler(config, {
  onWaitlistRecorded: () => waitlistOutbox?.wake(),
  waitlistStore,
});

const server = Bun.serve({
  fetch: route,
  hostname: config.host,
  port: config.port,
});

console.log(`${config.serviceName} listening on ${server.hostname}:${server.port}`);

async function shutdown(signal: string): Promise<void> {
  console.log(`${config.serviceName} received ${signal}; shutting down`);
  waitlistOutbox?.stop();
  server.stop(true);
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
