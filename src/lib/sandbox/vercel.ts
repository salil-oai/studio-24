import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NetworkPolicy } from "@vercel/sandbox";
import {
  buildSandboxCommandEnv,
  getSandboxSnapshotId,
  getSandboxTimeoutMs,
} from "@/lib/sandbox/config";
import type { SandboxJobInput } from "@/lib/sandbox/docker";
import {
  parseSandboxWorkerOutput,
  type SandboxWorkerSuccess,
} from "@/lib/sandbox/result";
import { getOptionalEnv } from "@/lib/env";

const WORKER_DIR = "/vercel/sandbox/studio-24-worker";
const JOB_DIR = "/vercel/sandbox/studio-24-job";
const WORKER_PATH = `${WORKER_DIR}/worker.mjs`;
const INPUT_PATH = `${JOB_DIR}/input.json`;
const OUTPUT_PATH = `${JOB_DIR}/output.json`;

function buildNetworkPolicy(input: SandboxJobInput, needsInstall: boolean): NetworkPolicy {
  if (input.mode === "mock" && !needsInstall) {
    return "deny-all";
  }

  const allow = ["api.openai.com", "*.openai.com"];
  if (needsInstall) {
    allow.push("registry.npmjs.org", "*.npmjs.org");
  }

  return { allow };
}

async function readWorkerSource(): Promise<string> {
  return readFile(
    path.join(/* turbopackIgnore: true */ process.cwd(), "sandbox", "worker.mjs"),
    "utf8",
  );
}

async function readWorkerPackageJson(): Promise<string> {
  return readFile(
    path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "sandbox",
      "package.json",
    ),
    "utf8",
  );
}

async function ensureFreshWorkerInstalled(
  sandbox: Awaited<ReturnType<typeof import("@vercel/sandbox").Sandbox.create>>,
  signal: AbortSignal,
): Promise<void> {
  await sandbox.mkDir(WORKER_DIR, { signal });
  await sandbox.writeFiles(
    [
      { path: `${WORKER_DIR}/package.json`, content: await readWorkerPackageJson() },
      { path: WORKER_PATH, content: await readWorkerSource() },
    ],
    { signal },
  );

  const install = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "--omit=dev", "--no-audit", "--no-fund"],
    cwd: WORKER_DIR,
    signal,
  });

  if (install.exitCode !== 0) {
    throw new Error(
      `Vercel Sandbox worker dependency install failed: ${(
        await install.stderr({ signal })
      ).slice(0, 1200)}`,
    );
  }
}

export async function runVercelSandboxJob(
  input: SandboxJobInput,
): Promise<SandboxWorkerSuccess> {
  const { Sandbox } = await import("@vercel/sandbox");
  const timeoutMs = getSandboxTimeoutMs();
  const snapshotId = getSandboxSnapshotId();
  const needsInstall = !snapshotId;
  const allowFreshSandbox = getOptionalEnv("SANDBOX_ALLOW_FRESH_VERCEL") === "1";

  if (needsInstall && process.env.NODE_ENV === "production" && !allowFreshSandbox) {
    throw new Error(
      "SANDBOX_SNAPSHOT_ID is required for Vercel Sandbox runs in production.",
    );
  }

  const signal = AbortSignal.timeout(timeoutMs);
  const createParams: Record<string, unknown> = {
    env: buildSandboxCommandEnv(),
    networkPolicy: buildNetworkPolicy(input, needsInstall),
    resources: { vcpus: 1 },
    timeout: timeoutMs,
    signal,
  };

  if (snapshotId) {
    createParams.source = { type: "snapshot", snapshotId };
  } else {
    createParams.runtime = "node24";
  }

  const sandbox = await Sandbox.create(createParams);

  try {
    if (needsInstall) {
      await ensureFreshWorkerInstalled(sandbox, signal);
    }

    await sandbox.mkDir(JOB_DIR, { signal });
    await sandbox.writeFiles(
      [{ path: INPUT_PATH, content: JSON.stringify(input) }],
      { signal },
    );

    const command = await sandbox.runCommand({
      cmd: "node",
      args: [WORKER_PATH, "--input", INPUT_PATH, "--output", OUTPUT_PATH],
      cwd: WORKER_DIR,
      env: buildSandboxCommandEnv(),
      signal,
    });

    const workerOutput = await sandbox.fs
      .readFile(OUTPUT_PATH, { encoding: "utf8", signal })
      .catch(() => null);

    if (workerOutput) {
      const parsedOutput = parseSandboxWorkerOutput(workerOutput);
      if (command.exitCode === 0) {
        return parsedOutput;
      }
    }

    const stderr = await command.stderr({ signal }).catch(() => "");
    throw new Error(
      `Vercel Sandbox worker failed with exit code ${command.exitCode}: ${stderr.slice(
        0,
        1200,
      )}`,
    );
  } finally {
    await sandbox.stop({ blocking: true }).catch(() => undefined);
  }
}
