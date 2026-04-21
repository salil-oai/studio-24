import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  buildSandboxCommandEnv,
  getSandboxDockerImage,
  getSandboxTimeoutMs,
  type SandboxJobMode,
} from "@/lib/sandbox/config";
import {
  parseSandboxWorkerOutput,
  type SandboxWorkerSuccess,
} from "@/lib/sandbox/result";

const execFile = promisify(execFileCallback);

export type SandboxJobInput = {
  jobType: "subagent_smoke";
  prompt: string;
  mode: SandboxJobMode;
  expectedForbiddenEnv: string[];
};

function getDockerClientEnv(commandEnv: Record<string, string>): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    NODE_ENV: process.env.NODE_ENV ?? "development",
    ...commandEnv,
  };
}

function formatDockerFailure(error: unknown): Error {
  if (error instanceof Error) {
    return new Error(
      `Docker sandbox command failed. Run pnpm sandbox:docker:build, then retry. ${error.message}`,
    );
  }

  return new Error(
    "Docker sandbox command failed. Run pnpm sandbox:docker:build, then retry.",
  );
}

export async function runDockerSandboxJob(
  input: SandboxJobInput,
): Promise<SandboxWorkerSuccess> {
  const timeoutMs = getSandboxTimeoutMs();
  const image = getSandboxDockerImage();
  const jobId = randomUUID();
  const containerName = `studio-24-sandbox-${jobId}`;
  const jobDir = await mkdtemp(path.join(tmpdir(), "studio-24-sandbox-"));
  const inputPath = path.join(jobDir, "input.json");
  const outputPath = path.join(jobDir, "output.json");
  const commandEnv = buildSandboxCommandEnv();

  await writeFile(inputPath, JSON.stringify(input), "utf8");

  const networkArgs = input.mode === "mock" ? ["--network", "none"] : [];
  const envArgs = Object.keys(commandEnv).flatMap((key) => ["--env", key]);
  const dockerArgs = [
    "run",
    "--rm",
    "--name",
    containerName,
    "--cpus",
    "1",
    "--memory",
    "768m",
    "--pids-limit",
    "128",
    ...networkArgs,
    "--volume",
    `${jobDir}:/studio-24-job`,
    "--workdir",
    "/app",
    ...envArgs,
    image,
    "--input",
    "/studio-24-job/input.json",
    "--output",
    "/studio-24-job/output.json",
  ];

  try {
    await execFile("docker", dockerArgs, {
      env: getDockerClientEnv(commandEnv),
      maxBuffer: 1024 * 1024,
      timeout: timeoutMs,
    });

    const output = await readFile(outputPath, "utf8");
    return parseSandboxWorkerOutput(output);
  } catch (error) {
    const workerOutput = await readFile(outputPath, "utf8").catch(() => null);
    if (workerOutput) {
      return parseSandboxWorkerOutput(workerOutput);
    }

    await execFile("docker", ["rm", "-f", containerName], {
      env: getDockerClientEnv({}),
    }).catch(() => undefined);

    throw formatDockerFailure(error);
  } finally {
    if (process.env.SANDBOX_KEEP_JOB_DIR !== "1") {
      await rm(jobDir, { recursive: true, force: true });
    }
  }
}
