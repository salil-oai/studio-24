import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSandboxCommandEnv,
  FORBIDDEN_SANDBOX_ENV_KEYS,
  getSandboxDriver,
  getSandboxTimeoutMs,
} from "@/lib/sandbox/config";

describe("sandbox config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to Docker outside Vercel", () => {
    vi.stubEnv("SANDBOX_DRIVER", "");
    vi.stubEnv("VERCEL", "");

    expect(getSandboxDriver()).toBe("docker");
  });

  it("defaults to Vercel inside Vercel", () => {
    vi.stubEnv("SANDBOX_DRIVER", "");
    vi.stubEnv("VERCEL", "1");

    expect(getSandboxDriver()).toBe("vercel");
  });

  it("honors explicit sandbox driver config", () => {
    vi.stubEnv("SANDBOX_DRIVER", "docker");
    vi.stubEnv("VERCEL", "1");

    expect(getSandboxDriver()).toBe("docker");
  });

  it("keeps storage and app secrets out of sandbox command env", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "blob-secret");
    vi.stubEnv("DATABASE_URL", "postgres://secret");
    vi.stubEnv("POSTGRES_PASSWORD", "postgres-secret");
    vi.stubEnv("PGPASSWORD", "pg-secret");
    vi.stubEnv("APP_SESSION_SECRET", "session-secret");
    vi.stubEnv("APP_PASSWORD", "password");

    const env = buildSandboxCommandEnv();

    expect(env).toEqual({
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "crest-alpha",
    });
  });

  it("tracks local and hosted storage credentials as forbidden sandbox env", () => {
    expect(FORBIDDEN_SANDBOX_ENV_KEYS).toEqual(
      expect.arrayContaining([
        "APP_SESSION_SECRET",
        "BLOB_READ_WRITE_TOKEN",
        "DATABASE_URL",
        "NEON_PROJECT_ID",
        "PGPASSWORD",
        "POSTGRES_PASSWORD",
        "POSTGRES_URL",
      ]),
    );
  });

  it("caps sandbox timeout to the route max duration window", () => {
    vi.stubEnv("SANDBOX_TIMEOUT_MS", "999999");

    expect(getSandboxTimeoutMs()).toBe(300000);
  });
});
