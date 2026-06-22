import { describe, expect, test } from "bun:test";
import { loadConfig } from "../../src/config";

describe("loadConfig", () => {
  test("uses production defaults", () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      allowedOrigins: ["https://deadrot.com", "https://www.deadrot.com"],
      cdnOrigin: "https://cdn.deadrot.com",
      databaseSslMode: "no-verify",
      host: "0.0.0.0",
      port: 3004,
      serviceName: "deadrot-api",
    });
  });

  test("parses explicit settings", () => {
    const config = loadConfig({
      ALLOWED_ORIGINS: "https://deadrot.com, http://localhost:3000",
      CDN_ORIGIN: "https://cdn.example.com",
      DATABASE_SSL_MODE: "verify-full",
      DATABASE_URL: "postgres://example",
      HOST: "127.0.0.1",
      PORT: "4010",
      SERVICE_NAME: "example-api",
    });

    expect(config).toMatchObject({
      allowedOrigins: ["https://deadrot.com", "http://localhost:3000"],
      cdnOrigin: "https://cdn.example.com",
      databaseSslMode: "verify-full",
      databaseUrl: "postgres://example",
      host: "127.0.0.1",
      port: 4010,
      serviceName: "example-api",
    });
  });

  test("rejects invalid ports", () => {
    expect(() => loadConfig({ PORT: "wat" })).toThrow("Invalid PORT value");
  });
});
