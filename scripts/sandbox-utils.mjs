import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DEFAULT_DOCKER_IMAGE = "studio-24-agent-sandbox:local";
export const DEFAULT_MODEL = "crest-alpha";
export const WORKER_DIR = "/vercel/sandbox/studio-24-worker";
export const JOB_DIR = "/vercel/sandbox/studio-24-job";
export const WORKER_PATH = `${WORKER_DIR}/worker.mjs`;
export const INPUT_PATH = `${JOB_DIR}/input.json`;
export const OUTPUT_PATH = `${JOB_DIR}/output.json`;

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
];

export function loadEnvFile(filePath = ".env.local") {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

export function getSandboxCommandEnv() {
  const env = {
    OPENAI_MODEL: process.env.OPENAI_MODEL || DEFAULT_MODEL,
  };

  for (const key of ["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"]) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }

  return env;
}

export function getModeFromArgs(argv = process.argv) {
  return argv.includes("--live") ? "live" : "mock";
}

export function getTimeoutMs() {
  const timeout = Number(process.env.SANDBOX_TIMEOUT_MS || "120000");
  return Number.isFinite(timeout) && timeout > 0 ? Math.trunc(timeout) : 120000;
}

export function getWorkerSource() {
  return fs.readFileSync(path.join(process.cwd(), "sandbox", "worker.mjs"), "utf8");
}

export function getWorkerPackageJson() {
  return fs.readFileSync(
    path.join(process.cwd(), "sandbox", "package.json"),
    "utf8",
  );
}

export function makeSmokeInput(mode) {
  if (mode === "live" && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for --live sandbox smoke runs.");
  }

  return {
    jobType: "subagent_smoke",
    prompt:
      "Confirm that this Studio 24 sandboxed sub-agent can receive a task and return a short result.",
    mode,
    expectedForbiddenEnv: FORBIDDEN_SANDBOX_ENV_KEYS,
  };
}

export async function runCommand(command, args, options = {}) {
  return execFileAsync(command, args, {
    maxBuffer: 1024 * 1024,
    ...options,
  });
}

export async function makeTempJobDir() {
  return fsp.mkdtemp(path.join(os.tmpdir(), "studio-24-sandbox-"));
}

export async function removeTempJobDir(jobDir) {
  if (process.env.SANDBOX_KEEP_JOB_DIR === "1") return;
  await fsp.rm(jobDir, { recursive: true, force: true });
}

export async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, "utf8"));
}

export function getDockerImage() {
  return process.env.SANDBOX_DOCKER_IMAGE || DEFAULT_DOCKER_IMAGE;
}
