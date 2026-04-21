export type SandboxDriver = "docker" | "vercel";
export type SandboxJobMode = "mock" | "live";

export const DEFAULT_SANDBOX_DOCKER_IMAGE = "studio-24-agent-sandbox:local";
export const DEFAULT_SANDBOX_MODEL = "crest-alpha";
export const DEFAULT_SANDBOX_TIMEOUT_MS = 120_000;
export const MAX_SANDBOX_TIMEOUT_MS = 300_000;

export const FORBIDDEN_SANDBOX_ENV_KEYS = [
  "APP_PASSWORD",
  "APP_SESSION_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "DECK_STORAGE_DRIVER",
  "LOCAL_DECK_PUBLIC_BASE_URL",
  "LOCAL_DECK_STORAGE_DIR",
  "NEON_PROJECT_ID",
  "PGDATABASE",
  "PGHOST",
  "PGHOST_UNPOOLED",
  "PGPASSWORD",
  "PGUSER",
  "POSTGRES_DATABASE",
  "POSTGRES_HOST",
  "POSTGRES_PASSWORD",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_USER",
  "POSTGRES_URL",
  "POSTGRES_URL_NO_SSL",
  "POSTGRES_URL_NON_POOLING",
  "VERCEL_ACCESS_TOKEN",
  "VERCEL_OIDC_TOKEN",
  "VERCEL_TOKEN",
] as const;

const ALLOWED_SANDBOX_ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
] as const;

type EnvMap = Record<string, string | undefined>;

export function getSandboxDriver(env: EnvMap = process.env): SandboxDriver {
  const configuredDriver = env.SANDBOX_DRIVER?.trim();

  if (configuredDriver === "docker" || configuredDriver === "vercel") {
    return configuredDriver;
  }

  if (configuredDriver) {
    throw new Error("SANDBOX_DRIVER must be either docker or vercel.");
  }

  return env.VERCEL ? "vercel" : "docker";
}

export function getSandboxTimeoutMs(env: EnvMap = process.env): number {
  const configuredTimeout = env.SANDBOX_TIMEOUT_MS?.trim();
  if (!configuredTimeout) return DEFAULT_SANDBOX_TIMEOUT_MS;

  const parsedTimeout = Number(configuredTimeout);
  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    throw new Error("SANDBOX_TIMEOUT_MS must be a positive number.");
  }

  return Math.min(Math.trunc(parsedTimeout), MAX_SANDBOX_TIMEOUT_MS);
}

export function getSandboxDockerImage(env: EnvMap = process.env): string {
  return env.SANDBOX_DOCKER_IMAGE?.trim() || DEFAULT_SANDBOX_DOCKER_IMAGE;
}

export function getSandboxSnapshotId(env: EnvMap = process.env): string | undefined {
  return env.SANDBOX_SNAPSHOT_ID?.trim() || undefined;
}

export function buildSandboxCommandEnv(
  env: EnvMap = process.env,
): Record<string, string> {
  const commandEnv: Record<string, string> = {
    OPENAI_MODEL: env.OPENAI_MODEL?.trim() || DEFAULT_SANDBOX_MODEL,
  };

  for (const key of ALLOWED_SANDBOX_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) {
      commandEnv[key] = value;
    }
  }

  return commandEnv;
}

export function assertSandboxReadyForMode(
  mode: SandboxJobMode,
  env: EnvMap = process.env,
): void {
  if (mode === "live" && !env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is required for live sandbox sub-agent runs.");
  }
}
